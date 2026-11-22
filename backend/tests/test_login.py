"""Las 11 personas de prueba de dataMock.js, de punta a punta."""

import pytest

from app.acceso import MSG_CREDENCIALES, MSG_DESACTIVADO, MSG_EGRESADOS, MSG_SERVICIO_ROLES, MSG_SIN_ROL
from tests.conftest import CONTRASENA, entrar


async def login(c, usuario: str, contrasena: str = CONTRASENA):
    return await c.post("/api/auth/login", json={"usuario": usuario, "contrasena": contrasena})


@pytest.mark.parametrize(
    ("usuario", "perfil"),
    [
        ("admin.prueba", "ADMINISTRADOR"),
        ("ana.estudiante", "CONSULTANTE"),
        ("carlos.profesor", "CONSULTANTE"),
        ("diana.catedratica", "CONSULTANTE"),
        ("pedro.funcionario", "CONSULTANTE"),
    ],
)
async def test_personas_que_entran(anonimo, usuario, perfil) -> None:
    r = await login(anonimo, usuario)
    assert r.status_code == 200, r.text
    assert r.json()["perfil"] == perfil
    assert "portal_sesion" in anonimo.cookies
    me = await anonimo.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["usuario"] == usuario


@pytest.mark.parametrize(
    ("usuario", "estado", "mensaje"),
    [
        ("laura.egresada", 403, MSG_EGRESADOS),
        ("mario.mayusculas", 403, MSG_EGRESADOS),
        ("sofia.sinrol", 403, MSG_SIN_ROL),
        ("jorge.contratista", 403, MSG_SIN_ROL),
        ("luis.externo", 403, MSG_SIN_ROL),
        ("usuario.error", 503, MSG_SERVICIO_ROLES),
    ],
)
async def test_personas_que_no_entran(anonimo, usuario, estado, mensaje) -> None:
    r = await login(anonimo, usuario)
    assert r.status_code == estado
    assert r.json()["detail"] == mensaje
    assert "portal_sesion" not in anonimo.cookies  # no se crea ninguna sesión
    assert (await anonimo.get("/api/auth/me")).status_code == 401


async def test_contrasena_incorrecta(anonimo) -> None:
    r = await login(anonimo, "ana.estudiante", "otra")
    assert r.status_code == 401
    assert r.json()["detail"] == MSG_CREDENCIALES


async def test_usuario_inexistente(anonimo) -> None:
    r = await login(anonimo, "nadie.existe")
    assert r.status_code == 401
    assert r.json()["detail"] == MSG_CREDENCIALES


async def test_diana_ve_su_rol_normalizado(anonimo) -> None:
    datos = (await login(anonimo, "diana.catedratica")).json()
    rol = datos["roles_institucionales"][0]
    assert rol["original"] == "Catedraticos"
    assert rol["codigo"] == "CATEDRÁTICOS"
    assert rol["da_acceso"]


async def test_pedro_entra_por_funcionarios_y_egresados_no_da_acceso(anonimo) -> None:
    datos = (await login(anonimo, "pedro.funcionario")).json()
    acceso = {r["codigo"]: r["da_acceso"] for r in datos["roles_institucionales"]}
    assert acceso == {"EGRESADOS": False, "FUNCIONARIOS": True}
    assert datos["roles_con_acceso"] == ["FUNCIONARIOS"]


async def test_registro_automatico_como_consultante(app, admin) -> None:
    await (await entrar(app, "carlos.profesor")).aclose()
    usuarios = (await admin.get("/api/admin/usuarios")).json()
    carlos = next(u for u in usuarios if u["usuario"] == "carlos.profesor")
    assert carlos["perfil"] == "CONSULTANTE"
    assert carlos["origen"] == "REGISTRO_AUTOMATICO"
    assert carlos["roles"] == []


async def test_quien_no_entra_no_queda_registrado(anonimo, admin) -> None:
    await login(anonimo, "laura.egresada")
    usuarios = {u["usuario"] for u in (await admin.get("/api/admin/usuarios")).json()}
    assert "laura.egresada" not in usuarios


async def test_luis_entra_con_un_rol_asignado_por_admin(admin, anonimo) -> None:
    roles = {r["codigo"]: r["id"] for r in (await admin.get("/api/admin/roles")).json()}
    r = await admin.post(
        "/api/admin/usuarios",
        json={
            "usuario": "luis.externo",
            "nombre": "Luis Barrios",
            "correo": "luis.externo@ejemplo.edu.co",
            "perfil": "CONSULTANTE",
            "rol_ids": [roles["FUNCIONARIOS"]],
        },
    )
    assert r.status_code == 201, r.text
    r = await login(anonimo, "luis.externo")
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["roles_institucionales"] == []
    assert [x["codigo"] for x in datos["roles_asignados"]] == ["FUNCIONARIOS"]


async def test_laura_no_entra_aunque_le_asignen_egresados(admin, anonimo) -> None:
    roles = {r["codigo"]: r["id"] for r in (await admin.get("/api/admin/roles")).json()}
    await admin.post(
        "/api/admin/usuarios",
        json={
            "usuario": "laura.egresada",
            "nombre": "Laura",
            "correo": "laura@ejemplo.edu.co",
            "rol_ids": [roles["EGRESADOS"]],
        },
    )
    r = await login(anonimo, "laura.egresada")
    assert r.json()["detail"] == MSG_EGRESADOS


async def test_usuario_desactivado_no_entra(app, admin, anonimo) -> None:
    await (await entrar(app, "ana.estudiante")).aclose()
    ana = next(u for u in (await admin.get("/api/admin/usuarios")).json() if u["usuario"] == "ana.estudiante")
    assert (await admin.put(f"/api/admin/usuarios/{ana['id']}", json={"activo": False})).status_code == 200
    r = await login(anonimo, "ana.estudiante")
    assert r.status_code == 403
    assert r.json()["detail"] == MSG_DESACTIVADO


async def test_logout(ana) -> None:
    assert (await ana.post("/api/auth/logout")).status_code == 204
    assert (await ana.get("/api/auth/me")).status_code == 401
