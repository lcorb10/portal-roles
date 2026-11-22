"""Sesión y permisos. Cada petición vuelve a revisar en la base de datos si la persona sigue
activa, su perfil y sus roles asignados: los cambios del administrador aplican en la siguiente
acción de esa persona, sin esperar a que vuelva a iniciar sesión."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.acceso import MSG_DESACTIVADO, Evaluacion, evaluar
from app.config import Settings
from app.datamock import DataMockClient
from app.db import DbDep
from app.models import Perfil, Usuario
from app.servicios import cargar_catalogo, perfil_efectivo

MSG_SIN_SESION = "Inicia sesión para continuar."
MSG_SESION_TERMINADA = "Tu sesión terminó. Inicia sesión de nuevo."
MSG_SOLO_ADMIN = "Esta opción es solo para administradores."


def obtener_settings(request: Request) -> Settings:
    return request.app.state.settings


def obtener_datamock(request: Request) -> DataMockClient:
    return request.app.state.datamock


SettingsDep = Annotated[Settings, Depends(obtener_settings)]
DataMockDep = Annotated[DataMockClient, Depends(obtener_datamock)]


@dataclass
class Contexto:
    usuario: Usuario
    perfil: Perfil
    institucionales: list[str]
    evaluacion: Evaluacion

    @property
    def es_admin(self) -> bool:
        return self.perfil == Perfil.ADMINISTRADOR


def _cerrar(request: Request, motivo: str) -> HTTPException:
    request.session.clear()
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=motivo)


async def contexto_actual(request: Request, db: DbDep, settings: SettingsDep) -> Contexto:
    datos = request.session
    usuario_id = datos.get("uid")
    if not isinstance(usuario_id, int):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=MSG_SIN_SESION)

    usuario = await db.get(Usuario, usuario_id)
    if usuario is None:
        raise _cerrar(request, MSG_SESION_TERMINADA)
    if not usuario.activo:
        raise _cerrar(request, MSG_DESACTIVADO)

    institucionales = [r for r in datos.get("inst", []) if isinstance(r, str)]
    evaluacion = evaluar(institucionales, [r.codigo for r in usuario.roles], await cargar_catalogo(db))
    if not evaluacion.tiene_acceso:
        raise _cerrar(request, evaluacion.motivo_rechazo or MSG_SESION_TERMINADA)

    return Contexto(usuario, perfil_efectivo(usuario, settings), institucionales, evaluacion)


ContextoDep = Annotated[Contexto, Depends(contexto_actual)]


async def solo_admin(contexto: ContextoDep) -> Contexto:
    if not contexto.es_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=MSG_SOLO_ADMIN)
    return contexto


AdminDep = Annotated[Contexto, Depends(solo_admin)]
