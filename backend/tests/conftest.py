"""Las pruebas usan el dataMock.js REAL (sin cambios) y una base SQLite temporal.

dataMock se lanza con Node en un puerto libre y con tokens que vencen a los 2 segundos,
para probar también la renovación del token."""

import os
import shutil
import socket
import subprocess
import time
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import httpx
import pytest

from app.config import Settings
from app.main import create_app

RAIZ = Path(__file__).resolve().parents[2]
DATAMOCK = RAIZ / "dataMock.js"
CONTRASENA = "Prueba2026*"


def puerto_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def datamock_url() -> Iterator[str]:
    node = shutil.which("node")
    if node is None or not DATAMOCK.exists():
        pytest.skip("Se necesita Node.js y dataMock.js para estas pruebas")
    puerto = puerto_libre()
    entorno = {**os.environ, "PORT": str(puerto), "TOKEN_VIGENCIA_SEGUNDOS": "2"}
    proceso = subprocess.Popen(
        [node, str(DATAMOCK)], env=entorno, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    url = f"http://127.0.0.1:{puerto}"
    for _ in range(50):
        try:
            if httpx.get(f"{url}/salud", timeout=0.5).status_code == 200:
                break
        except httpx.HTTPError:
            time.sleep(0.1)
    else:
        proceso.kill()
        pytest.fail("dataMock no arrancó")
    yield url
    proceso.terminate()
    proceso.wait(timeout=5)


@pytest.fixture
def settings(datamock_url: str, tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        mock_api_url=datamock_url,
        roles_client_id="portal-roles",
        roles_client_secret="secreto-de-prueba",
        ia_api_key="clave-ia-de-prueba",
        admin_usernames="admin.prueba",
        session_secret="x" * 40,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'pruebas.db'}",
    )


@pytest.fixture
async def app(settings: Settings):
    aplicacion = create_app(settings)
    async with aplicacion.router.lifespan_context(aplicacion):
        yield aplicacion


def cliente(app) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://portal.test")


@pytest.fixture
async def anonimo(app) -> AsyncIterator[httpx.AsyncClient]:
    async with cliente(app) as c:
        yield c


async def entrar(app, usuario: str) -> httpx.AsyncClient:
    c = cliente(app)
    r = await c.post("/api/auth/login", json={"usuario": usuario, "contrasena": CONTRASENA})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture
async def admin(app) -> AsyncIterator[httpx.AsyncClient]:
    c = await entrar(app, "admin.prueba")
    yield c
    await c.aclose()


@pytest.fixture
async def ana(app) -> AsyncIterator[httpx.AsyncClient]:
    c = await entrar(app, "ana.estudiante")
    yield c
    await c.aclose()
