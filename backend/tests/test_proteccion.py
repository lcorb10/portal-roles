"""Protección contra bots: prueba de trabajo, límite de intentos y campo trampa."""

import hashlib

import httpx
import pytest

from app.main import create_app
from app.proteccion import DIFICULTAD_ALTA, DIFICULTAD_BASE, MSG_DEMASIADOS, MSG_VERIFICACION, _bits_en_cero
from tests.conftest import CONTRASENA


def resolver(reto: str, dificultad: int) -> str:
    """Lo mismo que hace el navegador: buscar un nonce que cumpla la dificultad."""
    n = 0
    while _bits_en_cero(hashlib.sha256(f"{reto}{n}".encode()).digest()) < dificultad:
        n += 1
    return str(n)


@pytest.fixture
async def protegido(settings):
    app = create_app(settings.model_copy(update={"proteccion_bots": True}))
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://portal.test"
        ) as c:
            yield c


async def intentar(c, usuario="ana.estudiante", contrasena=CONTRASENA, **extra):
    datos = (await c.get("/api/auth/reto")).json()
    cuerpo = {
        "usuario": usuario,
        "contrasena": contrasena,
        "reto": datos["reto"],
        "nonce": resolver(datos["reto"], datos["dificultad"]),
        **extra,
    }
    return await c.post("/api/auth/login", json=cuerpo), datos


async def test_login_con_reto_resuelto(protegido) -> None:
    r, datos = await intentar(protegido)
    assert datos["dificultad"] == DIFICULTAD_BASE
    assert r.status_code == 200


async def test_sin_reto_no_entra(protegido) -> None:
    r = await protegido.post("/api/auth/login", json={"usuario": "ana.estudiante", "contrasena": CONTRASENA})
    assert r.status_code == 400 and r.json()["detail"] == MSG_VERIFICACION


async def test_reto_mal_resuelto_o_reutilizado(protegido) -> None:
    datos = (await protegido.get("/api/auth/reto")).json()
    malo = {"usuario": "ana.estudiante", "contrasena": CONTRASENA, "reto": datos["reto"], "nonce": "x"}
    assert (await protegido.post("/api/auth/login", json=malo)).status_code in (400, 200)
    bueno = {**malo, "nonce": resolver(datos["reto"], datos["dificultad"])}
    primero = await protegido.post("/api/auth/login", json=bueno)
    segundo = await protegido.post("/api/auth/login", json=bueno)
    assert primero.status_code == 200
    assert segundo.status_code == 400  # un reto solo sirve una vez


async def test_reto_alterado(protegido) -> None:
    datos = (await protegido.get("/api/auth/reto")).json()
    partes = datos["reto"].split(".")
    partes[1] = "1"  # intentar bajar la dificultad
    alterado = ".".join(partes)
    r = await protegido.post(
        "/api/auth/login",
        json={
            "usuario": "ana.estudiante",
            "contrasena": CONTRASENA,
            "reto": alterado,
            "nonce": resolver(alterado, 1),
        },
    )
    assert r.status_code == 400


async def test_campo_trampa(protegido) -> None:
    r, _ = await intentar(protegido, sitio_web="http://spam.example")
    assert r.status_code == 400


async def test_dificultad_sube_y_bloqueo_por_usuario(protegido) -> None:
    for i in range(5):
        r, datos = await intentar(protegido, contrasena="mala")
        assert r.status_code == 401
        if i >= 3:
            assert datos["dificultad"] == DIFICULTAD_ALTA
    r, _ = await intentar(protegido)  # ahora incluso con la contraseña correcta
    assert r.status_code == 429 and r.json()["detail"] == MSG_DEMASIADOS


def test_bits_en_cero() -> None:
    assert _bits_en_cero(b"\x00\x00\xff") == 16
    assert _bits_en_cero(b"\x00\x0f") == 12
    assert _bits_en_cero(b"\x80") == 0
