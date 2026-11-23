"""Verificador de acceso (admin) e intérprete del asistente."""

import pytest

from app.acceso import MSG_DESACTIVADO, MSG_EGRESADOS, MSG_SERVICIO_ROLES, MSG_SIN_ROL
from app.interprete import interpretar

# ── Verificador ───────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("usuario", "entraria", "mensaje", "en_roles"),
    [
        ("pedro.funcionario", True, "Entraría como CONSULTANTE por FUNCIONARIOS.", True),
        ("admin.prueba", True, "Entraría como ADMINISTRADOR por FUNCIONARIOS.", True),
        ("mario.mayusculas", False, MSG_EGRESADOS, True),
        ("jorge.contratista", False, MSG_SIN_ROL, True),
        ("luis.externo", False, MSG_SIN_ROL, False),
        ("usuario.error", False, MSG_SERVICIO_ROLES, None),
    ],
)
async def test_verificador(admin, usuario, entraria, mensaje, en_roles) -> None:
    r = await admin.get(f"/api/admin/verificar/{usuario}")
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["entraria"] is entraria
    assert datos["mensaje"] == mensaje
    assert datos["en_sistema_de_roles"] is en_roles


async def test_verificador_no_registra_ni_crea_sesion(admin) -> None:
    await admin.get("/api/admin/verificar/carlos.profesor")
    usuarios = {u["usuario"] for u in (await admin.get("/api/admin/usuarios")).json()}
    assert "carlos.profesor" not in usuarios


async def test_verificador_ve_desactivados(admin, ana) -> None:
    yo_ana = (await ana.get("/api/auth/me")).json()
    await admin.put(f"/api/admin/usuarios/{yo_ana['id']}", json={"activo": False})
    datos = (await admin.get("/api/admin/verificar/ana.estudiante")).json()
    assert datos["entraria"] is False and datos["mensaje"] == MSG_DESACTIVADO


async def test_verificador_solo_admin(ana, anonimo) -> None:
    assert (await anonimo.get("/api/admin/verificar/ana.estudiante")).status_code == 401
    assert (await ana.get("/api/admin/verificar/ana.estudiante")).status_code == 403


# ── Intérprete (sin red) ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("texto", "intencion"),
    [
        ("que roles tengo", "mis-roles"),
        ("Mis roles?", "mis-roles"),
        ("cuáles son mis roles", "mis-roles"),
        ("soy admin?", "mi-perfil"),
        ("cual es mi perfil", "mi-perfil"),
        ("quiénes pueden entrar al portal", "roles-con-acceso"),
        ("qué roles dan acceso", "roles-con-acceso"),
        ("los egresados pueden entrar?", "egresados"),
        ("como hago para ser administrador", "pedir-admin"),
        ("quiero permisos de admin", "pedir-admin"),
        ("cuantos usuarios hay", "total-usuarios"),
        ("cuántas personas están registradas", "total-usuarios"),
        ("cuantos admins hay", "total-administradores"),
        ("como le agrego un rol a alguien", "asignar-rol"),
    ],
)
def test_intenciones(texto, intencion) -> None:
    resultado = interpretar(texto)
    assert (resultado.tipo, resultado.intencion) == ("oficial", intencion)


@pytest.mark.parametrize(
    ("texto", "tipo"),
    [
        ("hola", "saludo"),
        ("Buenos días!", "saludo"),
        ("gracias", "gracias"),
        ("ayuda", "ayuda"),
        ("como reservo una sala", "reservas"),
        ("chao", "despedida"),
    ],
)
def test_charla(texto, tipo) -> None:
    assert interpretar(texto) == interpretar(texto).__class__("charla", tipo)


@pytest.mark.parametrize("texto", ["", "  ", "el clima de hoy", "asdfgh", "receta de arepas"])
def test_sin_intencion(texto) -> None:
    assert interpretar(texto).tipo == "nada"


# ── Intérprete por la API ─────────────────────────────────────────────────────────────────


async def libre(c, texto: str) -> dict:
    r = await c.post("/api/asistente", json={"pregunta": texto, "estricto": False})
    assert r.status_code == 200, r.text
    return r.json()


async def test_modo_libre_traduce_y_responde_la_ia(ana) -> None:
    datos = await libre(ana, "que roles tengo")
    assert datos["interpretada_como"] == "¿Qué roles tengo?"
    assert datos["respuesta"] == "Hola, Ana Martínez. Tus roles son: ESTUDIANTES."
    assert datos["origen"] == "ia"


async def test_modo_libre_saludo_es_del_portal(ana) -> None:
    datos = await libre(ana, "hola")
    assert datos["origen"] == "portal"
    assert datos["respuesta"].startswith("¡Hola, Ana!")


async def test_modo_libre_sin_intencion_no_inventa(ana) -> None:
    datos = await libre(ana, "cuál es la capital de Francia")
    assert datos["respuesta"] is None


async def test_modo_libre_consultante_no_recibe_respuestas_de_admin(ana) -> None:
    datos = await libre(ana, "cuantos usuarios hay")
    assert datos["respuesta"] is None and datos["interpretada_como"] is None


async def test_modo_libre_admin_recibe_conteo(admin) -> None:
    datos = await libre(admin, "cuantos admins hay")
    assert datos["respuesta"] == "Hay 1 administradores en el portal."


async def test_modo_estricto_por_defecto(ana) -> None:
    r = await ana.post("/api/asistente", json={"pregunta": "que roles tengo"})
    assert r.json()["respuesta"] is None
