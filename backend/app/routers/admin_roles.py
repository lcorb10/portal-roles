from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.acceso import EGRESADOS, normalizar
from app.db import DbDep
from app.deps import AdminDep, solo_admin
from app.models import Rol, usuario_roles
from app.schemas import RolCrear, RolEditar, RolOut
from app.servicios import auditar

router = APIRouter(prefix="/api/admin/roles", tags=["roles"], dependencies=[Depends(solo_admin)])

RolId = Annotated[int, Path(ge=1)]


def a_salida(rol: Rol, asignados: int) -> RolOut:
    protegido = rol.codigo_normalizado == EGRESADOS
    return RolOut(
        id=rol.id,
        codigo=rol.codigo,
        nombre=rol.nombre,
        descripcion=rol.descripcion,
        activo=rol.activo,
        protegido=protegido,
        usuarios_asignados=asignados,
        da_acceso=rol.activo and not protegido,
    )


async def contar_asignados(db: DbDep, rol_id: int) -> int:
    return (
        await db.scalar(
            select(func.count()).select_from(usuario_roles).where(usuario_roles.c.rol_id == rol_id)
        )
        or 0
    )


async def buscar_rol(db: DbDep, rol_id: int) -> Rol:
    rol = await db.get(Rol, rol_id)
    if rol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="El rol no existe.")
    return rol


@router.get("")
async def listar_roles(db: DbDep) -> list[RolOut]:
    conteo = (
        select(usuario_roles.c.rol_id, func.count().label("n")).group_by(usuario_roles.c.rol_id).subquery()
    )
    filas = (
        await db.execute(
            select(Rol, func.coalesce(conteo.c.n, 0))
            .outerjoin(conteo, conteo.c.rol_id == Rol.id)
            .order_by(Rol.id)
        )
    ).all()
    return [a_salida(rol, n) for rol, n in filas]


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear_rol(datos: RolCrear, db: DbDep, admin: AdminDep) -> RolOut:
    clave = normalizar(datos.codigo)
    existente = await db.scalar(select(Rol).where(Rol.codigo_normalizado == clave))
    if existente is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Ya existe el rol {existente.codigo}. El código no puede repetirse "
            "aunque cambien mayúsculas, tildes o espacios.",
        )
    rol = Rol(
        codigo=datos.codigo.upper(),
        codigo_normalizado=clave,
        nombre=datos.nombre,
        descripcion=datos.descripcion,
        activo=True,
    )
    db.add(rol)
    auditar(db, admin.usuario.usuario, "ROL_CREADO", f"Creó el rol {rol.codigo}.")
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Ya existe un rol con ese código.") from None
    return a_salida(rol, 0)


@router.put("/{rol_id}")
async def editar_rol(rol_id: RolId, datos: RolEditar, db: DbDep, admin: AdminDep) -> RolOut:
    rol = await buscar_rol(db, rol_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    for campo, valor in cambios.items():
        setattr(rol, campo, valor)
    if cambios:
        detalle = ", ".join(f"{k}={v}" for k, v in cambios.items())
        auditar(db, admin.usuario.usuario, "ROL_EDITADO", f"Editó el rol {rol.codigo}: {detalle}.")
    await db.commit()
    return a_salida(rol, await contar_asignados(db, rol.id))


@router.delete("/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_rol(rol_id: RolId, db: DbDep, admin: AdminDep) -> Response:
    rol = await buscar_rol(db, rol_id)
    if rol.codigo_normalizado == EGRESADOS:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="El rol EGRESADOS no se puede eliminar: es una regla fija del portal.",
        )
    asignados = await contar_asignados(db, rol.id)
    if asignados:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"No se puede eliminar {rol.codigo}: está asignado a {asignados} "
            f"usuario{'s' if asignados != 1 else ''}. Quítaselo primero o desactívalo.",
        )
    await db.delete(rol)
    auditar(db, admin.usuario.usuario, "ROL_ELIMINADO", f"Eliminó el rol {rol.codigo}.")
    try:
        await db.commit()
    except IntegrityError:  # se asignó justo ahora
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="El rol está asignado a usuarios.") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
