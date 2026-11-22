"""Asistente con la IA simulada (sección 8).

- Coincidencia exacta: la pregunta se envía tal cual; la IA decide si coincide.
- El backend reemplaza las {variables} con datos reales.
- Las preguntas de perfil ADMINISTRADOR solo se responden a administradores.
- Si la IA no responde, no se inventa ninguna respuesta (respuesta = null).
"""

import logging
import re

from fastapi import APIRouter, HTTPException, status

from app.acceso import EGRESADOS, normalizar
from app.datamock import ServicioNoDisponible
from app.db import DbDep
from app.deps import ContextoDep, DataMockDep, SettingsDep
from app.models import Perfil
from app.schemas import PreguntaIn, PreguntaOut, RespuestaAsistente
from app.servicios import cargar_catalogo, contar_usuarios

log = logging.getLogger("portal.asistente")

MSG_IA_CAIDA = "El asistente no está disponible en este momento. Intenta más tarde."
VARIABLE = re.compile(r"\{(\w+)\}")

router = APIRouter(prefix="/api/asistente", tags=["asistente"])


def puede_ver(perfil_pregunta: str, perfil_usuario: Perfil) -> bool:
    if perfil_pregunta == "TODOS":
        return True
    return perfil_pregunta == Perfil.ADMINISTRADOR and perfil_usuario == Perfil.ADMINISTRADOR


@router.get("/preguntas")
async def preguntas(contexto: ContextoDep, mock: DataMockDep) -> list[PreguntaOut]:
    try:
        todas = await mock.preguntas_ia()
    except ServicioNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=MSG_IA_CAIDA) from None
    return [
        PreguntaOut(id=str(p.get("id", "")), pregunta=str(p["pregunta"]), perfil=str(p.get("perfil", "")))
        for p in todas
        if isinstance(p.get("pregunta"), str) and puede_ver(str(p.get("perfil", "")), contexto.perfil)
    ]


async def valores(
    contexto: ContextoDep, db: DbDep, settings: SettingsDep, usadas: set[str]
) -> dict[str, str]:
    """Calcula solo las variables que la respuesta necesita."""
    datos: dict[str, str] = {
        "nombre": contexto.usuario.nombre,
        "roles": ", ".join(contexto.evaluacion.codigos),
        "perfil": str(contexto.perfil),
    }
    if "roles_con_acceso" in usadas:
        catalogo = await cargar_catalogo(db)
        datos["roles_con_acceso"] = (
            ", ".join(
                r.codigo for clave, r in catalogo.items() if r.activo and clave != normalizar(EGRESADOS)
            )
            or "ninguno"
        )
    if usadas & {"total_usuarios", "total_administradores"}:
        total, admins = await contar_usuarios(db, settings)
        datos["total_usuarios"] = str(total)
        datos["total_administradores"] = str(admins)
    return datos


@router.post("")
async def preguntar(
    entrada: PreguntaIn, contexto: ContextoDep, db: DbDep, mock: DataMockDep, settings: SettingsDep
) -> RespuestaAsistente:
    try:
        resultado = await mock.chat_ia(entrada.pregunta)
    except ServicioNoDisponible:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=MSG_IA_CAIDA) from None

    if resultado is None:
        return RespuestaAsistente(pregunta=entrada.pregunta, respuesta=None)

    if not puede_ver(str(resultado.get("perfil", "")), contexto.perfil):
        log.info(
            "%s (%s) pidió una respuesta solo para administradores", contexto.usuario.usuario, contexto.perfil
        )
        return RespuestaAsistente(pregunta=entrada.pregunta, respuesta=None)

    plantilla: str = resultado["respuesta"]
    usadas = set(VARIABLE.findall(plantilla))
    datos = await valores(contexto, db, settings, usadas)
    texto = VARIABLE.sub(lambda m: datos.get(m.group(1), m.group(0)), plantilla)
    return RespuestaAsistente(pregunta=entrada.pregunta, respuesta=texto)
