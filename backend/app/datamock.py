"""Cliente HTTP de los servicios institucionales simulados (dataMock.js).

- Siempre revisa el campo "codigo" (texto), no solo el estado HTTP.
- Guarda el token OAuth2 y pide uno nuevo solo cuando vence (o si el servicio lo rechaza).
- Cualquier error, respuesta inesperada o demora mayor al timeout se traduce en ServicioNoDisponible.
"""

import asyncio
import logging
import time
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings

log = logging.getLogger("portal.datamock")

# Margen para renovar el token un poco antes de que venza.
MARGEN_TOKEN_SEGUNDOS = 5


class ServicioNoDisponible(Exception):
    """El servicio respondió con error, en un formato inesperado o no respondió a tiempo."""


class CredencialesInvalidas(Exception):
    pass


class DataMockClient:
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._settings = settings
        self._http = httpx.AsyncClient(
            base_url=settings.mock_api_url,
            timeout=httpx.Timeout(settings.servicio_timeout_segundos),
            transport=transport,
        )
        self._token: str | None = None
        self._token_vence: float = 0.0
        self._lock = asyncio.Lock()
        self.tokens_solicitados = 0  # útil para las pruebas de la caché

    async def aclose(self) -> None:
        await self._http.aclose()

    # ── utilidades ────────────────────────────────────────────────────────────────────────

    async def _pedir(self, metodo: str, ruta: str, **kwargs: Any) -> tuple[int, dict[str, Any]]:
        try:
            respuesta = await self._http.request(metodo, ruta, **kwargs)
            cuerpo = respuesta.json()
        except httpx.TimeoutException as error:
            log.warning("dataMock no respondió a tiempo: %s %s", metodo, ruta)
            raise ServicioNoDisponible("timeout") from error
        except (httpx.HTTPError, ValueError) as error:
            log.warning("Fallo al llamar a dataMock %s %s: %s", metodo, ruta, type(error).__name__)
            raise ServicioNoDisponible(str(error)) from error
        if not isinstance(cuerpo, dict):
            raise ServicioNoDisponible("respuesta sin formato de sobre")
        return respuesta.status_code, cuerpo

    @staticmethod
    def _resultado(cuerpo: dict[str, Any]) -> list[Any]:
        resultado = cuerpo.get("resultado")
        if not isinstance(resultado, list):
            raise ServicioNoDisponible("'resultado' no es una lista")
        return resultado

    # ── token OAuth2 (client_credentials) ─────────────────────────────────────────────────

    async def _obtener_token(self, forzar: bool = False) -> str:
        async with self._lock:
            if not forzar and self._token and time.monotonic() < self._token_vence:
                return self._token
            estado, cuerpo = await self._pedir(
                "POST",
                "/oauth/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._settings.roles_client_id,
                    "client_secret": self._settings.roles_client_secret,
                },
            )
            token = cuerpo.get("access_token")
            if estado != 200 or not isinstance(token, str) or not token:
                log.error("No se obtuvo token OAuth: %s", cuerpo.get("error"))
                raise ServicioNoDisponible("sin token")
            expira = cuerpo.get("expires_in")
            expira = float(expira) if isinstance(expira, int | float) else 60.0
            self._token = token
            self._token_vence = time.monotonic() + max(expira - MARGEN_TOKEN_SEGUNDOS, expira / 2)
            self.tokens_solicitados += 1
            return token

    async def _get_con_token(self, ruta: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        """GET autenticado. Si el token fue rechazado (codigo "401"), pide uno nuevo y reintenta una vez."""
        for intento in range(2):
            token = await self._obtener_token(forzar=intento > 0)
            _, cuerpo = await self._pedir(
                "GET", ruta, params=params, headers={"Authorization": f"Bearer {token}"}
            )
            if cuerpo.get("codigo") != "401":
                return cuerpo
            log.info("Token rechazado por dataMock; se pide uno nuevo")
        raise ServicioNoDisponible("token rechazado")

    # ── SSO ───────────────────────────────────────────────────────────────────────────────

    async def login(self, usuario: str, contrasena: str) -> dict[str, str]:
        _, cuerpo = await self._pedir(
            "POST", "/sso/login", json={"username": usuario, "password": contrasena}
        )
        codigo = cuerpo.get("codigo")
        if codigo in ("401", "400"):
            raise CredencialesInvalidas()
        if codigo != "200":
            raise ServicioNoDisponible(f"sso codigo {codigo}")
        resultado = self._resultado(cuerpo)
        persona = resultado[0] if resultado else None
        if not isinstance(persona, dict) or not isinstance(persona.get("username"), str):
            raise ServicioNoDisponible("sso sin persona")
        return {
            "username": persona["username"],
            "nombre": str(persona.get("nombre") or persona["username"]),
            "correo": str(persona.get("correo") or ""),
        }

    # ── Roles ─────────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _roles_de_resultado(resultado: list[Any]) -> list[str]:
        if not resultado:
            return []
        roles = resultado[0].get("roles") if isinstance(resultado[0], dict) else None
        if not isinstance(roles, list) or not all(isinstance(r, str) for r in roles):
            raise ServicioNoDisponible("formato de roles inesperado")
        return roles

    async def catalogo_roles(self) -> list[str]:
        cuerpo = await self._get_con_token("/roles")
        if cuerpo.get("codigo") != "200":
            raise ServicioNoDisponible(f"catalogo codigo {cuerpo.get('codigo')}")
        return self._roles_de_resultado(self._resultado(cuerpo))

    async def roles_de(self, usuario: str) -> list[str]:
        """Roles institucionales. Una persona que no existe en el sistema de roles (codigo "404",
        aunque el HTTP sea 200) no tiene roles institucionales, pero puede tener roles asignados."""
        cuerpo = await self._get_con_token(f"/roles/{quote(usuario, safe='')}")
        codigo = cuerpo.get("codigo")
        if codigo == "404":
            return []
        if codigo != "200":
            raise ServicioNoDisponible(f"roles codigo {codigo}")
        return self._roles_de_resultado(self._resultado(cuerpo))

    async def buscar_personas(self, texto: str) -> list[dict[str, str]]:
        cuerpo = await self._get_con_token("/personas", params={"buscar": texto})
        if cuerpo.get("codigo") != "200":
            raise ServicioNoDisponible(f"personas codigo {cuerpo.get('codigo')}")
        return [p for p in self._resultado(cuerpo) if isinstance(p, dict)]

    # ── IA simulada ───────────────────────────────────────────────────────────────────────

    @property
    def _cabecera_ia(self) -> dict[str, str]:
        return {"X-API-Key": self._settings.ia_api_key}

    async def preguntas_ia(self) -> list[dict[str, str]]:
        _, cuerpo = await self._pedir("GET", "/ia/preguntas", headers=self._cabecera_ia)
        if cuerpo.get("codigo") != "200":
            raise ServicioNoDisponible(f"ia codigo {cuerpo.get('codigo')}")
        return [p for p in self._resultado(cuerpo) if isinstance(p, dict)]

    async def chat_ia(self, pregunta: str) -> dict[str, Any] | None:
        """Devuelve {id, respuesta, perfil, variables} o None si la IA no respondió nada."""
        _, cuerpo = await self._pedir(
            "POST", "/ia/chat", json={"pregunta": pregunta}, headers=self._cabecera_ia
        )
        if cuerpo.get("codigo") != "200":
            raise ServicioNoDisponible(f"ia codigo {cuerpo.get('codigo')}")
        resultado = self._resultado(cuerpo)
        if not resultado or not isinstance(resultado[0], dict):
            return None
        respuesta = resultado[0]
        if not isinstance(respuesta.get("respuesta"), str) or not respuesta["respuesta"].strip():
            return None
        return respuesta
