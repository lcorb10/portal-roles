from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, StringConstraints

from app.models import Origen, Perfil

Texto = Annotated[str, StringConstraints(strip_whitespace=True)]


class Entrada(BaseModel):
    """Rechaza campos desconocidos (por ejemplo, intentar cambiar el código de un rol)."""

    model_config = ConfigDict(extra="forbid")


# ── Autenticación / Mi acceso ─────────────────────────────────────────────────────────────


class LoginIn(Entrada):
    usuario: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
    contrasena: Annotated[str, Field(min_length=1, max_length=200)]


class RolAcceso(BaseModel):
    codigo: str
    original: str
    en_catalogo: bool
    activo: bool
    da_acceso: bool
    motivo: str


class MiAcceso(BaseModel):
    id: int
    usuario: str
    nombre: str
    correo: str
    perfil: Perfil
    perfil_por_configuracion: bool
    roles_institucionales: list[RolAcceso]
    roles_asignados: list[RolAcceso]
    roles: list[str]  # todos, sin repetir
    roles_con_acceso: list[str]
    ultimo_ingreso: datetime | None


# ── Roles ─────────────────────────────────────────────────────────────────────────────────


class RolCrear(Entrada):
    codigo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    descripcion: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] = ""


class RolEditar(Entrada):
    """El código no se puede cambiar después de creado: no es un campo editable."""

    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)] | None = (
        None
    )
    descripcion: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    activo: bool | None = None


class RolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    descripcion: str
    activo: bool
    protegido: bool  # EGRESADOS: no se puede eliminar
    usuarios_asignados: int
    da_acceso: bool


class RolResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    activo: bool


# ── Usuarios ──────────────────────────────────────────────────────────────────────────────

Username = Annotated[
    str,
    BeforeValidator(lambda v: v.strip().lower() if isinstance(v, str) else v),
    StringConstraints(min_length=3, max_length=60, pattern=r"^[a-z0-9._-]+$"),
]
Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]


class UsuarioCrear(Entrada):
    usuario: Username
    nombre: Nombre
    correo: EmailStr
    perfil: Perfil = Perfil.CONSULTANTE
    activo: bool = True
    rol_ids: list[int] = []


class UsuarioEditar(Entrada):
    """El nombre de usuario es la identidad institucional: no se cambia."""

    nombre: Nombre | None = None
    correo: EmailStr | None = None
    perfil: Perfil | None = None
    activo: bool | None = None
    rol_ids: list[int] | None = None


class UsuarioOut(BaseModel):
    id: int
    usuario: str
    nombre: str
    correo: str
    perfil: Perfil
    perfil_por_configuracion: bool
    activo: bool
    origen: Origen
    roles: list[RolResumen]
    ultimo_ingreso: datetime | None
    creado_en: datetime


class PersonaDirectorio(BaseModel):
    username: str
    nombre: str
    correo: str
    dependencia: str = ""
    ya_registrado: bool = False


# ── Asistente ─────────────────────────────────────────────────────────────────────────────


class PreguntaOut(BaseModel):
    id: str
    pregunta: str
    perfil: str


class PreguntaIn(Entrada):
    pregunta: Annotated[str, Field(min_length=1, max_length=500)]


class RespuestaAsistente(BaseModel):
    pregunta: str
    respuesta: str | None  # None: la IA no respondió (no se inventa nada)


# ── Auditoría ─────────────────────────────────────────────────────────────────────────────


class AuditoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    actor: str
    accion: str
    detalle: str


class Resumen(BaseModel):
    total_usuarios: int
    total_administradores: int
    usuarios_activos: int
    roles_activos: int
    roles_total: int
