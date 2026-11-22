import pytest

from tests.conftest import entrar


async def preguntar(c, pregunta: str):
    r = await c.post("/api/asistente", json={"pregunta": pregunta})
    assert r.status_code == 200, r.text
    return r.json()["respuesta"]


async def test_preguntas_segun_perfil(admin, ana) -> None:
    de_ana = (await ana.get("/api/asistente/preguntas")).json()
    del_admin = (await admin.get("/api/asistente/preguntas")).json()
    assert len(de_ana) == 5 and all(p["perfil"] == "TODOS" for p in de_ana)
    assert len(del_admin) == 8


async def test_ejemplo_del_enunciado(ana) -> None:
    assert await preguntar(ana, "¿Qué roles tengo?") == "Hola, Ana Martínez. Tus roles son: ESTUDIANTES."


async def test_variables_de_perfil_y_roles_con_acceso(ana) -> None:
    assert await preguntar(ana, "¿Cuál es mi perfil?") == "Tu perfil en el Portal de Roles es CONSULTANTE."
    assert await preguntar(ana, "¿Qué roles dan acceso al portal?") == (
        "Dan acceso los roles activos del catálogo, excepto EGRESADOS. "
        "Hoy son: ESTUDIANTES, FUNCIONARIOS, PROFESORES, CATEDRÁTICOS."
    )


async def test_roles_sin_repetir_en_respuesta(app) -> None:
    carlos = await entrar(app, "carlos.profesor")
    assert (
        await preguntar(carlos, "¿Qué roles tengo?")
        == "Hola, Carlos Rodríguez. Tus roles son: PROFESORES, CATEDRÁTICOS."
    )
    await carlos.aclose()


@pytest.mark.parametrize("pregunta", ["¿que roles tengo?", "Qué roles tengo", "hola", "¿Qué roles tengo?!"])
async def test_coincidencia_exacta_o_nada(ana, pregunta) -> None:
    assert await preguntar(ana, pregunta) is None


async def test_espacios_en_los_extremos_se_ignoran(ana) -> None:
    assert await preguntar(ana, "   ¿Cuál es mi perfil?  ") is not None


async def test_consultante_no_recibe_preguntas_de_admin(ana) -> None:
    assert await preguntar(ana, "¿Cuántos usuarios hay registrados?") is None
    assert await preguntar(ana, "¿Cuántos administradores hay?") is None


async def test_admin_recibe_conteos(app, admin) -> None:
    await (await entrar(app, "ana.estudiante")).aclose()
    assert (
        await preguntar(admin, "¿Cuántos usuarios hay registrados?")
        == "Hay 2 usuarios registrados en el portal."
    )
    assert await preguntar(admin, "¿Cuántos administradores hay?") == "Hay 1 administradores en el portal."


async def test_asistente_requiere_sesion(anonimo) -> None:
    assert (await anonimo.get("/api/asistente/preguntas")).status_code == 401
    assert (await anonimo.post("/api/asistente", json={"pregunta": "¿Qué roles tengo?"})).status_code == 401
