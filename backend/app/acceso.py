"""Reglas de acceso (sección 6). Funciones puras: no tocan la base de datos ni la red,
así se pueden probar con todos los casos sin levantar nada."""

import unicodedata
from dataclasses import dataclass, field

# Regla fija en el código, no configurable: EGRESADOS nunca da acceso.
EGRESADOS = "egresados"

MSG_CREDENCIALES = "Usuario o contraseña incorrectos."
MSG_EGRESADOS = "Los egresados no tienen acceso a este portal."
MSG_SIN_ROL = "No tienes un rol con acceso a este portal."
MSG_DESACTIVADO = "Tu usuario está desactivado. Habla con un administrador."
MSG_SERVICIO_ROLES = "No pudimos verificar tus roles. Intenta más tarde."


def normalizar(texto: str) -> str:
    """Quita tildes, pasa a minúsculas y recorta espacios en los extremos."""
    descompuesto = unicodedata.normalize("NFD", texto)
    sin_tildes = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return sin_tildes.strip().lower()


@dataclass(frozen=True)
class RolCatalogo:
    codigo: str
    activo: bool


@dataclass
class RolEvaluado:
    codigo: str  # como se muestra: el código del catálogo si existe, si no el texto recortado
    original: str  # como llegó (p. ej. "  egresados ")
    origenes: set[str] = field(default_factory=set)  # "institucional" y/o "aplicacion"
    en_catalogo: bool = False
    activo: bool = False
    da_acceso: bool = False

    @property
    def es_egresados(self) -> bool:
        return normalizar(self.codigo) == EGRESADOS

    @property
    def motivo(self) -> str:
        if self.da_acceso:
            return "Da acceso"
        if self.es_egresados:
            return "EGRESADOS nunca da acceso"
        if not self.en_catalogo:
            return "No está en el catálogo del portal"
        return "El rol está inactivo"


@dataclass
class Evaluacion:
    roles: list[RolEvaluado]

    @property
    def tiene_acceso(self) -> bool:
        return any(r.da_acceso for r in self.roles)

    @property
    def motivo_rechazo(self) -> str | None:
        if self.tiene_acceso:
            return None
        if any(r.es_egresados for r in self.roles):
            return MSG_EGRESADOS
        return MSG_SIN_ROL

    @property
    def codigos(self) -> list[str]:
        return [r.codigo for r in self.roles]


def evaluar_rol(texto: str, catalogo: dict[str, RolCatalogo]) -> RolEvaluado:
    clave = normalizar(texto)
    del_catalogo = catalogo.get(clave)
    if del_catalogo is None:
        return RolEvaluado(codigo=texto.strip().upper(), original=texto)
    return RolEvaluado(
        codigo=del_catalogo.codigo,
        original=texto,
        en_catalogo=True,
        activo=del_catalogo.activo,
        da_acceso=del_catalogo.activo and clave != EGRESADOS,
    )


def evaluar(
    institucionales: list[str],
    asignados: list[str],
    catalogo: dict[str, RolCatalogo],
) -> Evaluacion:
    """Suma los roles institucionales y los asignados en la aplicación, sin repetir
    (comparando normalizado), y marca cuáles dan acceso."""
    por_clave: dict[str, RolEvaluado] = {}
    for origen, textos in (("institucional", institucionales), ("aplicacion", asignados)):
        for texto in textos:
            clave = normalizar(texto)
            if not clave:
                continue
            rol = por_clave.get(clave) or evaluar_rol(texto, catalogo)
            rol.origenes.add(origen)
            por_clave.setdefault(clave, rol)
    return Evaluacion(roles=list(por_clave.values()))


def catalogo_por_clave(roles: list[tuple[str, bool]]) -> dict[str, RolCatalogo]:
    return {normalizar(codigo): RolCatalogo(codigo=codigo, activo=activo) for codigo, activo in roles}
