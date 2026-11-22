"""Operaciones compartidas entre rutas: catálogo, carga inicial, perfil efectivo y auditoría."""

import logging

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.acceso import RolCatalogo, catalogo_por_clave, normalizar
from app.config import Settings
from app.datamock import DataMockClient
from app.models import Auditoria, Perfil, Rol, Usuario

log = logging.getLogger("portal")


async def cargar_catalogo(db: AsyncSession) -> dict[str, RolCatalogo]:
    filas = (await db.execute(select(Rol.codigo, Rol.activo).order_by(Rol.id))).all()
    return catalogo_por_clave([(codigo, activo) for codigo, activo in filas])


def nombre_desde_codigo(codigo: str) -> str:
    return codigo.strip().capitalize()


async def asegurar_catalogo(db: AsyncSession, mock: DataMockClient) -> bool:
    """La primera vez (tabla vacía) carga el catálogo desde GET /roles. Devuelve True si cargó."""
    if await db.scalar(select(func.count()).select_from(Rol)):
        return False
    codigos = await mock.catalogo_roles()
    vistos: set[str] = set()
    for codigo in codigos:
        clave = normalizar(codigo)
        if not clave or clave in vistos:
            continue
        vistos.add(clave)
        limpio = codigo.strip().upper()
        db.add(
            Rol(
                codigo=limpio,
                codigo_normalizado=clave,
                nombre=nombre_desde_codigo(limpio),
                descripcion="Rol institucional cargado desde el servicio de roles.",
                activo=True,
            )
        )
    db.add(
        Auditoria(actor="sistema", accion="CATALOGO_INICIAL", detalle=f"Roles cargados: {', '.join(codigos)}")
    )
    try:
        await db.commit()
    except IntegrityError:  # otra petición lo cargó al mismo tiempo
        await db.rollback()
        return False
    log.info("Catálogo inicial cargado desde dataMock: %s", codigos)
    return True


def es_admin_por_configuracion(usuario: str, settings: Settings) -> bool:
    return usuario.lower() in settings.administradores


def perfil_efectivo(usuario: Usuario, settings: Settings) -> Perfil:
    if es_admin_por_configuracion(usuario.usuario, settings) or usuario.perfil == Perfil.ADMINISTRADOR:
        return Perfil.ADMINISTRADOR
    return Perfil.CONSULTANTE


async def contar_usuarios(db: AsyncSession, settings: Settings) -> tuple[int, int]:
    total = await db.scalar(select(func.count()).select_from(Usuario)) or 0
    condicion = Usuario.perfil == Perfil.ADMINISTRADOR
    if settings.administradores:
        condicion = or_(condicion, func.lower(Usuario.usuario).in_(settings.administradores))
    admins = await db.scalar(select(func.count()).select_from(Usuario).where(condicion)) or 0
    return total, admins


def auditar(db: AsyncSession, actor: str, accion: str, detalle: str) -> None:
    db.add(Auditoria(actor=actor, accion=accion, detalle=detalle))
