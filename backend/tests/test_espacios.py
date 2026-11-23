"""Reserva de espacios: los roles deciden qué se puede reservar."""

from datetime import timedelta

import pytest

from app.espacios import hoy
from tests.conftest import entrar

MANANA = (hoy() + timedelta(days=1)).isoformat()


async def espacios_de(c) -> dict[str, dict]:
    r = await c.get("/api/espacios")
    assert r.status_code == 200, r.text
    return {e["codigo"]: e for e in r.json()}


async def reservar(
    c, espacio_id: int, fecha=MANANA, inicio=9, fin=11, asistentes=2, motivo="Estudio de grupo"
):
    return await c.post(
        "/api/reservas",
        json={
            "espacio_id": espacio_id,
            "fecha": fecha,
            "hora_inicio": inicio,
            "hora_fin": fin,
            "motivo": motivo,
            "asistentes": asistentes,
        },
    )


async def test_espacios_requieren_sesion(anonimo) -> None:
    assert (await anonimo.get("/api/espacios")).status_code == 401
    assert (await anonimo.post("/api/reservas", json={})).status_code == 401


async def test_seis_espacios_iniciales_y_permisos_por_rol(ana) -> None:
    espacios = await espacios_de(ana)
    assert len(espacios) == 6
    assert espacios["sala-estudio"]["puede_reservar"]
    assert espacios["sala-estudio"]["habilitado_por"] == ["ESTUDIANTES"]
    assert not espacios["auditorio"]["puede_reservar"]
    assert "PROFESORES" in espacios["auditorio"]["motivo"]


async def test_diana_reserva_lab_por_rol_sin_tilde(app) -> None:
    diana = await entrar(app, "diana.catedratica")
    espacios = await espacios_de(diana)
    assert espacios["lab-computo"]["habilitado_por"] == ["CATEDRÁTICOS"]
    assert (await reservar(diana, espacios["lab-computo"]["id"])).status_code == 201
    await diana.aclose()


async def test_pedro_no_reserva_por_egresados_sino_por_funcionarios(app) -> None:
    pedro = await entrar(app, "pedro.funcionario")
    espacios = await espacios_de(pedro)
    assert espacios["sala-juntas"]["habilitado_por"] == ["FUNCIONARIOS"]
    await pedro.aclose()


async def test_no_puede_reservar_espacio_no_habilitado(ana) -> None:
    espacios = await espacios_de(ana)
    r = await reservar(ana, espacios["auditorio"]["id"])
    assert r.status_code == 403


async def test_reserva_y_cruces(app, ana) -> None:
    sala = (await espacios_de(ana))["sala-estudio"]["id"]
    assert (await reservar(ana, sala, inicio=9, fin=11)).status_code == 201

    carlos = await entrar(app, "carlos.profesor")
    r = await reservar(carlos, sala, inicio=10, fin=12)
    assert r.status_code == 409 and "ya está reservado" in r.json()["detail"]
    assert (await reservar(carlos, sala, inicio=11, fin=12)).status_code == 201  # contigua: sí

    disp = (await carlos.get(f"/api/espacios/{sala}/disponibilidad", params={"fecha": MANANA})).json()
    assert [(f["hora_inicio"], f["hora_fin"], f["propia"]) for f in disp["ocupadas"]] == [
        (9, 11, False),
        (11, 12, True),
    ]
    assert disp["ocupadas"][0]["por"] is None  # un consultante no ve quién reservó
    await carlos.aclose()

    # la misma persona no puede estar en dos espacios a la vez
    innovacion = (await espacios_de(ana))["innovacion"]["id"]
    r = await reservar(ana, innovacion, inicio=10, fin=11)
    assert r.status_code == 409 and "se cruza" in r.json()["detail"]


@pytest.mark.parametrize(
    ("cambios", "mensaje"),
    [
        ({"inicio": 6, "fin": 8}, "entre las 7:00"),
        ({"inicio": 9, "fin": 15}, "máximo 4 horas"),
        ({"fecha": (hoy() - timedelta(days=1)).isoformat()}, "pasado"),
        ({"fecha": (hoy() + timedelta(days=40)).isoformat()}, "30 días"),
        ({"asistentes": 9}, "capacidad para 8"),
    ],
)
async def test_reglas_de_la_reserva(ana, cambios, mensaje) -> None:
    sala = (await espacios_de(ana))["sala-estudio"]["id"]
    r = await reservar(ana, sala, **cambios)
    assert r.status_code == 409
    assert mensaje in r.json()["detail"]


async def test_maximo_tres_reservas_pendientes(ana) -> None:
    sala = (await espacios_de(ana))["sala-estudio"]["id"]
    for i in range(3):
        assert (await reservar(ana, sala, inicio=8 + i * 2, fin=9 + i * 2)).status_code == 201
    r = await reservar(ana, sala, inicio=17, fin=18)
    assert r.status_code == 409 and "máximo 3" in r.json()["detail"]


async def test_cancelar_propia_y_ajena(app, ana) -> None:
    sala = (await espacios_de(ana))["sala-estudio"]["id"]
    reserva = (await reservar(ana, sala)).json()
    carlos = await entrar(app, "carlos.profesor")
    assert (
        await carlos.post(f"/api/reservas/{reserva['id']}/cancelar", json={})
    ).status_code == 404  # no es suya
    await carlos.aclose()
    assert (await ana.post(f"/api/reservas/{reserva['id']}/cancelar", json={})).status_code == 204
    mias = (await ana.get("/api/reservas/mias")).json()
    assert mias[0]["estado"] == "CANCELADA"
    assert (await ana.post(f"/api/reservas/{reserva['id']}/cancelar", json={})).status_code == 409


async def test_admin_ve_todas_cancela_y_edita_roles(admin, ana) -> None:
    espacios = await espacios_de(ana)
    reserva = (await reservar(ana, espacios["sala-estudio"]["id"])).json()

    todas = (await admin.get("/api/admin/reservas")).json()
    assert [r["usuario"] for r in todas] == ["ana.estudiante"]
    url = f"/api/reservas/{reserva['id']}/cancelar"
    r = await admin.post(url, json={})  # sin motivo: no se puede
    assert r.status_code == 422 and "motivo" in r.json()["detail"]
    assert (
        await admin.post(url, json={"motivo": "Evento institucional en la biblioteca"})
    ).status_code == 204

    # Ana recibe el aviso con el motivo
    avisos = (await ana.get("/api/avisos")).json()
    assert len(avisos) == 1
    assert avisos[0]["motivo"] == "Evento institucional en la biblioteca"
    assert avisos[0]["por"] == "admin.prueba"
    mia = (await ana.get("/api/reservas/mias")).json()[0]
    assert mia["cancelada_por_otro"] and mia["motivo_cancelacion"] == "Evento institucional en la biblioteca"
    assert (await ana.post("/api/avisos/leidos")).status_code == 204
    assert (await ana.get("/api/avisos")).json() == []

    # habilitar el auditorio para ESTUDIANTES aplica de inmediato
    roles = {r["codigo"]: r["id"] for r in (await admin.get("/api/admin/roles")).json()}
    auditorio = espacios["auditorio"]
    r = await admin.put(
        f"/api/admin/espacios/{auditorio['id']}",
        json={"rol_ids": [*auditorio["rol_ids"], roles["ESTUDIANTES"]]},
    )
    assert r.status_code == 200
    assert (await espacios_de(ana))["auditorio"]["puede_reservar"]

    # deshabilitar el espacio
    await admin.put(f"/api/admin/espacios/{auditorio['id']}", json={"activo": False})
    assert (await espacios_de(ana))["auditorio"]["motivo"] == "El espacio no está disponible por ahora."


async def test_rutas_admin_de_espacios_protegidas(anonimo, ana) -> None:
    assert (await anonimo.get("/api/admin/reservas")).status_code == 401
    assert (await ana.get("/api/admin/reservas")).status_code == 403
    assert (await ana.put("/api/admin/espacios/1", json={"activo": False})).status_code == 403


async def test_cancelar_la_propia_no_genera_aviso(ana) -> None:
    sala = (await espacios_de(ana))["sala-estudio"]["id"]
    reserva = (await reservar(ana, sala)).json()
    assert (await ana.post(f"/api/reservas/{reserva['id']}/cancelar", json={})).status_code == 204
    assert (await ana.get("/api/avisos")).json() == []


async def test_avisos_requieren_sesion(anonimo) -> None:
    assert (await anonimo.get("/api/avisos")).status_code == 401
