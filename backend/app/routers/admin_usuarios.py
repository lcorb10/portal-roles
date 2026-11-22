from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.datamock import ServicioNoDisponible
from app.db import DbDep
from app.deps import AdminDep, DataMockDep, SettingsDep, solo_admin
from app.models import Auditoria, Origen, Perfil, Rol, Usuario
from app.schemas import (
    AuditoriaOut,
    PersonaDirectorio,
    Resumen,
    RolResumen,
    UsuarioCrear,
    UsuarioEditar,
    UsuarioOut,
)
from app.servicios import auditar, contar_usuarios, es_admin_por_configuracion, perfil_efectivo

router = APIRouter(prefix="/api/admin", tags=["usuarios"], dependencies=[Depends(solo_admin)])

UsuarioId = Annotated[int, Path(ge=1)]


def a_salida(usuario: Usuario, settings: SettingsDep) -> UsuarioOut:
    return UsuarioOut(
        id=usuario.id,
        usuario=usuario.usuario,
        nombre=usuario.nombre,
        correo=usuario.correo,
        perfil=perfil_efectivo(usuario, settings),
        perfil_por_configuracion=es_admin_por_configuracion(usuario.usuario, settings),
        activo=usuario.activo,
        origen=Origen(usuario.origen),
        roles=[RolResumen.model_validate(r) for r in usuario.roles],
        ultimo_ingreso=usuario.ultimo_ingreso,
        creado_en=usuario.creado_en,
    )


async def roles_por_id(db: DbDep, ids: list[int]) -> list[Rol]:
    unicos = sorted(set(ids))
    if not unicos:
        return []
    roles = list((await db.scalars(select(Rol).where(Rol.id.in_(unicos)))).all())
    if len(roles) != len(unicos):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Alguno de los roles no existe.")
    return roles


async def buscar_usuario(db: DbDep, usuario_id: int) -> Usuario:
    usuario = await db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="El usuario no existe.")
    return usuario


@router.get("/usuarios")
async def listar_usuarios(db: DbDep, settings: SettingsDep) -> list[UsuarioOut]:
    usuarios = (await db.scalars(select(Usuario).order_by(Usuario.usuario))).all()
    return [a_salida(u, settings) for u in usuarios]


@router.post("/usuarios", status_code=status.HTTP_201_CREATED)
async def crear_usuario(datos: UsuarioCrear, db: DbDep, admin: AdminDep, settings: SettingsDep) -> UsuarioOut:
    if await db.scalar(select(Usuario.id).where(Usuario.usuario == datos.usuario)):
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Ya existe el usuario {datos.usuario}.")
    perfil = Perfil.ADMINISTRADOR if es_admin_por_configuracion(datos.usuario, settings) else datos.perfil
    usuario = Usuario(
        usuario=datos.usuario,
        nombre=datos.nombre,
        correo=str(datos.correo),
        perfil=perfil,
        activo=datos.activo,
        origen=Origen.CREADO_POR_ADMIN,
        roles=await roles_por_id(db, datos.rol_ids),
    )
    db.add(usuario)
    auditar(
        db,
        admin.usuario.usuario,
        "USUARIO_CREADO",
        f"Creó a {usuario.usuario} ({perfil}) con roles: {', '.join(r.codigo for r in usuario.roles) or 'ninguno'}.",
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"Ya existe el usuario {datos.usuario}."
        ) from None
    await db.refresh(usuario)
    return a_salida(usuario, settings)


@router.put("/usuarios/{usuario_id}")
async def editar_usuario(
    usuario_id: UsuarioId, datos: UsuarioEditar, db: DbDep, admin: AdminDep, settings: SettingsDep
) -> UsuarioOut:
    usuario = await buscar_usuario(db, usuario_id)
    es_yo = usuario.id == admin.usuario.id

    if datos.activo is False and es_yo:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="No puedes desactivarte a ti mismo.")
    if datos.perfil == Perfil.CONSULTANTE:
        if es_admin_por_configuracion(usuario.usuario, settings):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"{usuario.usuario} es administrador por configuración (ADMIN_USERNAMES); "
                "su perfil no se puede cambiar desde aquí.",
            )
        if es_yo:
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="No puedes quitarte a ti mismo el perfil de administrador."
            )

    cambios: list[str] = []
    if datos.nombre is not None and datos.nombre != usuario.nombre:
        usuario.nombre = datos.nombre
        cambios.append(f"nombre={datos.nombre}")
    if datos.correo is not None and str(datos.correo) != usuario.correo:
        usuario.correo = str(datos.correo)
        cambios.append(f"correo={datos.correo}")
    if datos.perfil is not None and datos.perfil != usuario.perfil:
        usuario.perfil = datos.perfil
        cambios.append(f"perfil={datos.perfil}")
    if datos.activo is not None and datos.activo != usuario.activo:
        usuario.activo = datos.activo
        cambios.append("activado" if datos.activo else "desactivado")
    if datos.rol_ids is not None:
        nuevos = await roles_por_id(db, datos.rol_ids)
        antes = {r.codigo for r in usuario.roles}
        despues = {r.codigo for r in nuevos}
        if antes != despues:
            usuario.roles = nuevos
            cambios.append(f"roles={', '.join(sorted(despues)) or 'ninguno'}")

    if cambios:
        auditar(
            db, admin.usuario.usuario, "USUARIO_EDITADO", f"Editó a {usuario.usuario}: {'; '.join(cambios)}."
        )
    await db.commit()
    await db.refresh(usuario)
    return a_salida(usuario, settings)


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_usuario(usuario_id: UsuarioId, db: DbDep, admin: AdminDep) -> Response:
    usuario = await buscar_usuario(db, usuario_id)
    if usuario.id == admin.usuario.id:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="No puedes eliminarte a ti mismo.")
    await db.delete(usuario)
    auditar(db, admin.usuario.usuario, "USUARIO_ELIMINADO", f"Eliminó a {usuario.usuario}.")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/personas")
async def buscar_personas(
    buscar: Annotated[str, Query(min_length=2, max_length=60)], db: DbDep, mock: DataMockDep
) -> list[PersonaDirectorio]:
    """Directorio institucional (GET /personas) para autocompletar al crear un usuario."""
    try:
        personas = await mock.buscar_personas(buscar.strip())
    except ServicioNoDisponible:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="El directorio no está disponible ahora."
        ) from None
    registrados = set((await db.scalars(select(Usuario.usuario))).all())
    return [
        PersonaDirectorio(
            username=str(p.get("username", "")),
            nombre=str(p.get("nombre", "")),
            correo=str(p.get("correo", "")),
            dependencia=str(p.get("dependencia", "")),
            ya_registrado=p.get("username") in registrados,
        )
        for p in personas
        if p.get("username")
    ]


@router.get("/auditoria")
async def auditoria(db: DbDep, limite: Annotated[int, Query(ge=1, le=200)] = 50) -> list[AuditoriaOut]:
    filas = await db.scalars(select(Auditoria).order_by(Auditoria.id.desc()).limit(limite))
    return [AuditoriaOut.model_validate(f) for f in filas]


@router.get("/resumen")
async def resumen(db: DbDep, settings: SettingsDep) -> Resumen:
    total, admins = await contar_usuarios(db, settings)
    activos = await db.scalar(select(func.count()).select_from(Usuario).where(Usuario.activo)) or 0
    roles_total = await db.scalar(select(func.count()).select_from(Rol)) or 0
    roles_activos = await db.scalar(select(func.count()).select_from(Rol).where(Rol.activo)) or 0
    return Resumen(
        total_usuarios=total,
        total_administradores=admins,
        usuarios_activos=activos,
        roles_activos=roles_activos,
        roles_total=roles_total,
    )
