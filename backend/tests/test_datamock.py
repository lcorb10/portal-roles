"""Integración con dataMock: token, lectura de codigo y fallas del servicio."""

import asyncio

import httpx
import pytest

from app.acceso import MSG_SERVICIO_ROLES
from app.datamock import DataMockClient, ServicioNoDisponible
from app.main import create_app
from tests.conftest import CONTRASENA, cliente


async def test_token_se_guarda_y_se_renueva_al_vencer(settings) -> None:
    mock = DataMockClient(settings)
    await mock.roles_de("ana.estudiante")
    await mock.roles_de("carlos.profesor")
    await mock.catalogo_roles()
    assert mock.tokens_solicitados == 1  # se reutiliza el mismo token
    await asyncio.sleep(2.2)  # dataMock de pruebas: tokens de 2 s
    assert await mock.roles_de("ana.estudiante") == ["ESTUDIANTES"]
    assert mock.tokens_solicitados == 2
    await mock.aclose()


async def test_token_rechazado_se_pide_otro(settings) -> None:
    mock = DataMockClient(settings)
    await mock.roles_de("ana.estudiante")
    mock._token = "token-falso"  # simula un token revocado por el servidor
    assert await mock.roles_de("ana.estudiante") == ["ESTUDIANTES"]
    assert mock.tokens_solicitados == 2
    await mock.aclose()


async def test_http_200_con_codigo_404_no_tiene_roles(settings) -> None:
    mock = DataMockClient(settings)
    assert await mock.roles_de("luis.externo") == []
    await mock.aclose()


async def test_http_500_es_falla(settings) -> None:
    mock = DataMockClient(settings)
    with pytest.raises(ServicioNoDisponible):
        await mock.roles_de("usuario.error")
    await mock.aclose()


async def test_credenciales_oauth_malas_es_falla(settings) -> None:
    mock = DataMockClient(settings.model_copy(update={"roles_client_secret": "mal"}))
    with pytest.raises(ServicioNoDisponible):
        await mock.roles_de("ana.estudiante")
    await mock.aclose()


async def test_timeout_por_defecto_es_5_segundos(settings) -> None:
    assert settings.servicio_timeout_segundos == 5.0


async def test_servicio_de_roles_que_no_responde(settings) -> None:
    """Un servidor que acepta la conexión pero nunca contesta: debe cortar por timeout."""

    async def colgado(reader, writer):
        await asyncio.sleep(30)

    servidor = await asyncio.start_server(colgado, "127.0.0.1", 0)
    puerto = servidor.sockets[0].getsockname()[1]
    lento = settings.model_copy(
        update={"mock_api_url": f"http://127.0.0.1:{puerto}", "servicio_timeout_segundos": 0.3}
    )
    mock = DataMockClient(lento)
    with pytest.raises(ServicioNoDisponible):
        await mock.roles_de("ana.estudiante")
    await mock.aclose()
    servidor.close()


async def test_login_con_roles_caidos_no_entra(settings) -> None:
    """SSO responde, pero el servicio de roles se cuelga: no se deja entrar."""
    real = httpx.AsyncHTTPTransport()

    class RolesColgados(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
            if request.url.path.startswith("/roles/"):
                raise httpx.ReadTimeout("sin respuesta", request=request)
            return await real.handle_async_request(request)

    app = create_app(settings, DataMockClient(settings, transport=RolesColgados()))
    async with app.router.lifespan_context(app), cliente(app) as c:
        r = await c.post("/api/auth/login", json={"usuario": "ana.estudiante", "contrasena": CONTRASENA})
        assert r.status_code == 503
        assert r.json()["detail"] == MSG_SERVICIO_ROLES
        assert "portal_sesion" not in c.cookies


async def test_health(anonimo) -> None:
    r = await anonimo.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"estado": "ok", "base_de_datos": "ok"}
