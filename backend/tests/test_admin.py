"""Protección de /api/admin/*, catálogo de roles y usuarios."""

import pytest

from app.acceso import MSG_DESACTIVADO, MSG_SIN_ROL
from tests.conftest import entrar

RUTAS_ADMIN = [
    ("GET", "/api/admin/roles"),
    ("POST", "/api/admin/roles"),
    ("PUT", "/api/admin/roles/1"),
    ("DELETE", "/api/admin/roles/1"),
    ("GET", "/api/admin/usuarios"),
    ("POST", "/api/admin/usuarios"),
    ("PUT", "/api/admin/usuarios/1"),
    ("DELETE", "/api/admin/usuarios/1"),
    ("GET", "/api/admin/personas?buscar=an"),
    ("GET", "/api/admin/auditoria"),
    ("GET", "/api/admin/resumen"),
]


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS_ADMIN)
async def test_admin_sin_sesion_es_401(anonimo, metodo, ruta) -> None:
    assert (await anonimo.request(metodo, ruta, json={})).status_code == 401


@pytest.mark.parametrize(("metodo", "ruta"), RUTAS_ADMIN)
async def test_admin_como_consultante_es_403(ana, metodo, ruta) -> None:
    assert (await ana.request(metodo, ruta, json={})).status_code == 403


async def test_catalogo_inicial_desde_get_roles(admin) -> None:
    roles = (await admin.get("/api/admin/roles")).json()
    assert [r["codigo"] for r in roles] == [
        "ESTUDIANTES",
        "FUNCIONARIOS",
        "PROFESORES",
        "CATEDRÁTICOS",
        "EGRESADOS",
    ]
    egresados = roles[-1]
    assert egresados["protegido"] and not egresados["da_acceso"]


@pytest.mark.parametrize("codigo", ["estudiantes", " Estudiantes ", "ESTÚDIANTES", "catedraticos"])
async def test_codigo_unico_normalizado(admin, codigo) -> None:
    r = await admin.post("/api/admin/roles", json={"codigo": codigo, "nombre": "Duplicado"})
    assert r.status_code == 409


async def test_crud_de_rol(admin) -> None:
    r = await admin.post(
        "/api/admin/roles",
        json={
            "codigo": "investigadores",
            "nombre": "Investigadores",
            "descripcion": "Grupo de investigación",
        },
    )
    assert r.status_code == 201
    rol = r.json()
    assert rol["codigo"] == "INVESTIGADORES"

    r = await admin.put(f"/api/admin/roles/{rol['id']}", json={"nombre": "Investigación", "activo": False})
    assert r.status_code == 200
    assert r.json()["nombre"] == "Investigación" and r.json()["activo"] is False

    # El código no se puede cambiar
    r = await admin.put(f"/api/admin/roles/{rol['id']}", json={"codigo": "OTRO"})
    assert r.status_code == 422

    assert (await admin.delete(f"/api/admin/roles/{rol['id']}")).status_code == 204


async def test_egresados_no_se_elimina(admin) -> None:
    roles = {r["codigo"]: r["id"] for r in (await admin.get("/api/admin/roles")).json()}
    r = await admin.delete(f"/api/admin/roles/{roles['EGRESADOS']}")
    assert r.status_code == 409
    assert "EGRESADOS" in r.json()["detail"]


async def test_rol_asignado_no_se_elimina_409(admin) -> None:
    roles = {r["codigo"]: r["id"] for r in (await admin.get("/api/admin/roles")).json()}
    await admin.post(
        "/api/admin/usuarios",
        json={
            "usuario": "nuevo.user",
            "nombre": "Nuevo",
            "correo": "nuevo@ejemplo.edu.co",
            "rol_ids": [roles["PROFESORES"]],
        },
    )
    r = await admin.delete(f"/api/admin/roles/{roles['PROFESORES']}")
    assert r.status_code == 409
    assert "asignado a 1 usuario" in r.json()["detail"]


async def test_usuario_unico(admin) -> None:
    datos = {"usuario": "repetido", "nombre": "Uno", "correo": "uno@ejemplo.edu.co"}
    assert (await admin.post("/api/admin/usuarios", json=datos)).status_code == 201
    assert (
        await admin.post("/api/admin/usuarios", json={**datos, "usuario": " REPETIDO "})
    ).status_code == 409


async def test_admin_no_se_elimina_ni_desactiva_a_si_mismo(admin) -> None:
    yo = (await admin.get("/api/auth/me")).json()
    assert (await admin.delete(f"/api/admin/usuarios/{yo['id']}")).status_code == 409
    assert (await admin.put(f"/api/admin/usuarios/{yo['id']}", json={"activo": False})).status_code == 409
    assert (
        await admin.put(f"/api/admin/usuarios/{yo['id']}", json={"perfil": "CONSULTANTE"})
    ).status_code == 409


async def test_admin_asignado_por_otro_admin(app, admin) -> None:
    await (await entrar(app, "carlos.profesor")).aclose()
    carlos = next(
        u for u in (await admin.get("/api/admin/usuarios")).json() if u["usuario"] == "carlos.profesor"
    )
    await admin.put(f"/api/admin/usuarios/{carlos['id']}", json={"perfil": "ADMINISTRADOR"})
    c = await entrar(app, "carlos.profesor")
    assert (await c.get("/api/auth/me")).json()["perfil"] == "ADMINISTRADOR"
    assert (await c.get("/api/admin/roles")).status_code == 200
    await c.aclose()


async def test_desactivar_aplica_en_la_siguiente_accion(admin, ana) -> None:
    yo_ana = (await ana.get("/api/auth/me")).json()
    await admin.put(f"/api/admin/usuarios/{yo_ana['id']}", json={"activo": False})
    r = await ana.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["detail"] == MSG_DESACTIVADO


async def test_quitar_el_rol_que_daba_acceso_aplica_en_la_siguiente_accion(app, admin) -> None:
    roles = {r["codigo"]: r["id"] for r in (await admin.get("/api/admin/roles")).json()}
    r = await admin.post(
        "/api/admin/usuarios",
        json={
            "usuario": "luis.externo",
            "nombre": "Luis",
            "correo": "luis@ejemplo.edu.co",
            "rol_ids": [roles["ESTUDIANTES"]],
        },
    )
    luis_id = r.json()["id"]
    luis = await entrar(app, "luis.externo")
    assert (await luis.get("/api/auth/me")).status_code == 200
    await admin.put(f"/api/admin/usuarios/{luis_id}", json={"rol_ids": []})
    r = await luis.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["detail"] == MSG_SIN_ROL
    await luis.aclose()


async def test_consultante_promovido_ve_admin_sin_reingresar(admin, ana) -> None:
    yo_ana = (await ana.get("/api/auth/me")).json()
    assert (await ana.get("/api/admin/roles")).status_code == 403
    await admin.put(f"/api/admin/usuarios/{yo_ana['id']}", json={"perfil": "ADMINISTRADOR"})
    assert (await ana.get("/api/admin/roles")).status_code == 200


async def test_buscar_personas_en_directorio(admin) -> None:
    r = await admin.get("/api/admin/personas", params={"buscar": "martinez"})
    assert r.status_code == 200
    assert r.json()[0]["username"] == "ana.estudiante"


async def test_auditoria_registra_cambios(admin) -> None:
    await admin.post("/api/admin/roles", json={"codigo": "MONITORES", "nombre": "Monitores"})
    eventos = (await admin.get("/api/admin/auditoria")).json()
    assert eventos[0]["accion"] == "ROL_CREADO"
    assert eventos[0]["actor"] == "admin.prueba"


async def test_resumen(admin) -> None:
    datos = (await admin.get("/api/admin/resumen")).json()
    assert datos["total_administradores"] == 1
    assert datos["roles_activos"] == 5
