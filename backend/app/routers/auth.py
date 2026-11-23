import logging

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select

from app.acceso import (
    MSG_CREDENCIALES,
    MSG_DESACTIVADO,
    MSG_SERVICIO_ROLES,
    evaluar,
    evaluar_rol,
    normalizar,
)
from app.datamock import CredencialesInvalidas, ServicioNoDisponible
from app.db import DbDep
from app.deps import Contexto, ContextoDep, DataMockDep, SettingsDep
from app.espacios import asegurar_espacios
from app.models import Origen, Perfil, Usuario, ahora
from app.proteccion import MSG_DEMASIADOS, MSG_VERIFICACION, Proteccion
from app.schemas import LoginIn, MiAcceso, RetoOut, RolAcceso
from app.servicios import (
    asegurar_catalogo,
    auditar,
    cargar_catalogo,
    es_admin_por_configuracion,
    perfil_efectivo,
)

log = logging.getLogger("portal.auth")

MSG_SSO_CAIDO = "No pudimos validar tu usuario en este momento. Intenta más tarde."

router = APIRouter(prefix="/api/auth", tags=["autenticación"])


async def construir_mi_acceso(contexto: Contexto, db: DbDep, settings: SettingsDep) -> MiAcceso:
    catalogo = await cargar_catalogo(db)
    usuario = contexto.usuario

    def a_salida(textos: list[str]) -> list[RolAcceso]:
        vistos: set[str] = set()
        salida = []
        for texto in textos:
            clave = normalizar(texto)
            if not clave or clave in vistos:
                continue
            vistos.add(clave)
            rol = evaluar_rol(texto, catalogo)
            salida.append(RolAcceso(**{k: getattr(rol, k) for k in RolAcceso.model_fields}))
        return salida

    return MiAcceso(
        id=usuario.id,
        usuario=usuario.usuario,
        nombre=usuario.nombre,
        correo=usuario.correo,
        perfil=contexto.perfil,
        perfil_por_configuracion=es_admin_por_configuracion(usuario.usuario, settings),
        roles_institucionales=a_salida(contexto.institucionales),
        roles_asignados=a_salida([r.codigo for r in usuario.roles]),
        roles=contexto.evaluacion.codigos,
        roles_con_acceso=[r.codigo for r in contexto.evaluacion.roles if r.da_acceso],
        ultimo_ingreso=usuario.ultimo_ingreso,
    )


@router.post("/login")
async def login(
    datos: LoginIn, request: Request, db: DbDep, mock: DataMockDep, settings: SettingsDep
) -> MiAcceso:
    # Ningún intento fallido deja una sesión creada.
    request.session.clear()

    proteccion: Proteccion = request.app.state.proteccion
    ip = request.client.host if request.client else "?"
    clave_usuario = datos.usuario.strip().lower()
    if settings.proteccion_bots:
        if datos.sitio_web:
            log.warning("Campo trampa relleno desde %s", ip)
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=MSG_VERIFICACION)
        if proteccion.bloqueado(ip, clave_usuario):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=MSG_DEMASIADOS)
        if not proteccion.verificar(datos.reto or "", datos.nonce or ""):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=MSG_VERIFICACION)

    try:
        persona = await mock.login(datos.usuario, datos.contrasena)
    except CredencialesInvalidas:
        if settings.proteccion_bots:
            proteccion.registrar_fallo(ip, clave_usuario)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=MSG_CREDENCIALES) from None
    except ServicioNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=MSG_SSO_CAIDO) from None

    username = persona["username"].strip().lower()
    usuario = await db.scalar(select(Usuario).where(Usuario.usuario == username))

    if usuario is not None and not usuario.activo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=MSG_DESACTIVADO)

    try:
        institucionales = await mock.roles_de(username)
        await asegurar_catalogo(db, mock)
        await asegurar_espacios(db)
    except ServicioNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=MSG_SERVICIO_ROLES) from None

    asignados = [r.codigo for r in usuario.roles] if usuario else []
    evaluacion = evaluar(institucionales, asignados, await cargar_catalogo(db))
    if not evaluacion.tiene_acceso:
        log.info("Acceso denegado a %s: %s", username, evaluacion.motivo_rechazo)
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=evaluacion.motivo_rechazo)

    admin_env = es_admin_por_configuracion(username, settings)
    if usuario is None:
        usuario = Usuario(
            usuario=username,
            nombre=persona["nombre"],
            correo=persona["correo"],
            perfil=Perfil.ADMINISTRADOR if admin_env else Perfil.CONSULTANTE,
            origen=Origen.REGISTRO_AUTOMATICO,
            activo=True,
        )
        db.add(usuario)
        auditar(db, username, "REGISTRO_AUTOMATICO", f"{username} entró por primera vez y quedó registrado.")
    elif admin_env and usuario.perfil != Perfil.ADMINISTRADOR:
        usuario.perfil = Perfil.ADMINISTRADOR
    usuario.ultimo_ingreso = ahora()
    await db.commit()
    await db.refresh(usuario)

    request.session.update({"uid": usuario.id, "usuario": usuario.usuario, "inst": institucionales})
    proteccion.registrar_exito(ip, clave_usuario)
    log.info(
        "Ingreso de %s (%s) por %s",
        username,
        usuario.perfil,
        ", ".join(r.codigo for r in evaluacion.roles if r.da_acceso),
    )
    contexto = Contexto(usuario, perfil_efectivo(usuario, settings), institucionales, evaluacion)
    return await construir_mi_acceso(contexto, db, settings)


@router.get("/reto")
async def reto(request: Request) -> RetoOut:
    """Reto de prueba de trabajo para el próximo inicio de sesión (protección contra bots)."""
    proteccion: Proteccion = request.app.state.proteccion
    return RetoOut(**proteccion.nuevo_reto(request.client.host if request.client else "?"))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
async def mi_acceso(contexto: ContextoDep, db: DbDep, settings: SettingsDep) -> MiAcceso:
    return await construir_mi_acceso(contexto, db, settings)
