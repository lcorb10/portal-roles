"""Reglas de acceso sin red ni base de datos."""

import pytest

from app.acceso import MSG_EGRESADOS, MSG_SIN_ROL, catalogo_por_clave, evaluar, normalizar

CATALOGO = catalogo_por_clave(
    [
        ("ESTUDIANTES", True),
        ("FUNCIONARIOS", True),
        ("PROFESORES", True),
        ("CATEDRÁTICOS", True),
        ("EGRESADOS", True),
    ]
)


@pytest.mark.parametrize("texto", ["Catedraticos", " catedráticos ", "CATEDRÁTICOS", "CaTeDrÁtIcOs"])
def test_normalizar_ignora_mayusculas_tildes_y_espacios(texto: str) -> None:
    assert normalizar(texto) == "catedraticos"


@pytest.mark.parametrize(
    ("institucionales", "asignados", "entra", "motivo"),
    [
        (["ESTUDIANTES"], [], True, None),
        (["Catedraticos"], [], True, None),
        (["EGRESADOS", "FUNCIONARIOS"], [], True, None),
        (["EGRESADOS"], [], False, MSG_EGRESADOS),
        (["  egresados "], [], False, MSG_EGRESADOS),
        ([], [], False, MSG_SIN_ROL),
        (["CONTRATISTAS"], [], False, MSG_SIN_ROL),
        (["CONTRATISTAS", "EGRESADOS"], [], False, MSG_EGRESADOS),
        ([], ["PROFESORES"], True, None),  # solo por rol asignado en la aplicación
        (["EGRESADOS"], ["ESTUDIANTES"], True, None),
        ([], ["EGRESADOS"], False, MSG_EGRESADOS),  # asignar EGRESADOS tampoco da acceso
    ],
)
def test_quien_entra(institucionales, asignados, entra, motivo) -> None:
    ev = evaluar(institucionales, asignados, CATALOGO)
    assert ev.tiene_acceso is entra
    assert ev.motivo_rechazo == motivo


def test_roles_se_suman_sin_repetir() -> None:
    ev = evaluar(["PROFESORES", "Catedraticos"], ["catedráticos ", "ESTUDIANTES"], CATALOGO)
    assert ev.codigos == ["PROFESORES", "CATEDRÁTICOS", "ESTUDIANTES"]
    catedra = ev.roles[1]
    assert catedra.origenes == {"institucional", "aplicacion"}


def test_rol_inactivo_no_da_acceso() -> None:
    catalogo = catalogo_por_clave([("ESTUDIANTES", False), ("EGRESADOS", True)])
    ev = evaluar(["ESTUDIANTES"], [], catalogo)
    assert not ev.tiene_acceso
    assert ev.motivo_rechazo == MSG_SIN_ROL


def test_egresados_nunca_da_acceso_aunque_este_activo() -> None:
    ev = evaluar(["EGRESADOS"], [], CATALOGO)
    assert ev.roles[0].en_catalogo and ev.roles[0].activo
    assert not ev.roles[0].da_acceso
