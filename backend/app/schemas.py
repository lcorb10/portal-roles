from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, StringConstraints

from app.models import EstadoReserva, Origen, Perfil

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
    # Estricto (por defecto): la pregunta va tal cual a la IA, como pide el enunciado.
    # Sin modo estricto, el intérprete local traduce el mensaje a la pregunta oficial más parecida.
    estricto: bool = True


class RespuestaAsistente(BaseModel):
    pregunta: str
    respuesta: str | None  # None: no hay respuesta (no se inventa nada)
    # "ia": la respondió la IA de dataMock; "portal": mensaje fijo del portal (saludo, ayuda…)
    origen: str | None = None
    # Pregunta oficial que se le envió a la IA cuando el intérprete reconoció la intención.
    interpretada_como: str | None = None


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


# ── Espacios y reservas ───────────────────────────────────────────────────────────────────


class EspacioOut(BaseModel):
    id: int
    codigo: str
    nombre: str
    tipo: str
    ubicacion: str
    capacidad: int
    descripcion: str
    activo: bool
    roles_permitidos: list[str]
    rol_ids: list[int]
    puede_reservar: bool
    motivo: str | None  # por qué no puede reservarlo
    habilitado_por: list[str]  # roles de la persona que le permiten reservarlo


class EspacioEditar(Entrada):
    activo: bool | None = None
    capacidad: Annotated[int, Field(ge=1, le=2000)] | None = None
    rol_ids: list[int] | None = None


class ReservaCrear(Entrada):
    espacio_id: Annotated[int, Field(ge=1)]
    fecha: date
    hora_inicio: Annotated[int, Field(ge=0, le=23)]
    hora_fin: Annotated[int, Field(ge=1, le=24)]
    motivo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    asistentes: Annotated[int, Field(ge=1, le=2000)] = 1


class ReservaOut(BaseModel):
    id: int
    espacio_id: int
    espacio: str
    espacio_codigo: str
    ubicacion: str
    usuario: str
    nombre_usuario: str
    fecha: date
    hora_inicio: int
    hora_fin: int
    motivo: str
    asistentes: int
    estado: EstadoReserva
    creada_en: datetime
    cancelada_por: str | None
    cancelada_por_otro: bool
    motivo_cancelacion: str | None


class CancelarIn(Entrada):
    # Obligatorio cuando un administrador cancela la reserva de otra persona: ella lo verá.
    motivo: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class Aviso(BaseModel):
    id: int  # id de la reserva
    titulo: str
    detalle: str
    motivo: str | None
    por: str | None
    espacio_codigo: str
    fecha: datetime


class FranjaOcupada(BaseModel):
    hora_inicio: int
    hora_fin: int
    propia: bool
    por: str | None


class DisponibilidadOut(BaseModel):
    fecha: date
    ocupadas: list[FranjaOcupada]


class ReglasReserva(BaseModel):
    hora_apertura: int
    hora_cierre: int
    max_horas: int
    dias_adelante: int
    max_reservas: int
    hoy: date


# ── Verificador de acceso ─────────────────────────────────────────────────────────────────


class Verificacion(BaseModel):
    usuario: str
    entraria: bool
    mensaje: str  # el mismo que vería en la pantalla de inicio
    perfil: Perfil | None
    registrado: bool
    activo: bool | None
    en_sistema_de_roles: bool | None  # None: el servicio falló
    roles_institucionales: list[RolAcceso]
    roles_asignados: list[RolAcceso]
