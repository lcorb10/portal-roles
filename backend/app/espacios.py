"""Reserva de espacios del campus: qué espacios hay, quién puede reservarlos y las reglas de las reservas.

La idea: el portal no solo decide si alguien entra, también qué puede hacer adentro. Cada espacio indica
qué roles lo pueden reservar, y se usan los mismos roles que deciden el acceso (activos, del catálogo,
nunca EGRESADOS)."""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.acceso import Evaluacion, normalizar
from app.models import Espacio, EstadoReserva, Reserva, Rol

# Colombia no tiene horario de verano: UTC-5 fijo.
ZONA = timezone(timedelta(hours=-5), "America/Bogota")
HORA_APERTURA = 7
HORA_CIERRE = 21
MAX_HORAS = 4
DIAS_ADELANTE = 30
MAX_RESERVAS_FUTURAS = 3

# (codigo, nombre, tipo, ubicación, capacidad, descripción, roles que pueden reservarlo)
ESPACIOS_INICIALES = [
    (
        "sala-estudio",
        "Sala de estudio grupal",
        "Sala de estudio",
        "Biblioteca, piso 2",
        8,
        "Mesa para 8 personas, pantalla para conectar el portátil y pizarra de vidrio.",
        ["ESTUDIANTES", "PROFESORES", "CATEDRÁTICOS", "FUNCIONARIOS"],
    ),
    (
        "lab-computo",
        "Laboratorio de cómputo 3",
        "Laboratorio",
        "Bloque de Ingenierías, piso 3",
        30,
        "30 equipos con software de ingeniería, proyector y control de pantallas para clases prácticas.",
        ["PROFESORES", "CATEDRÁTICOS"],
    ),
    (
        "auditorio",
        "Auditorio principal",
        "Auditorio",
        "Edificio de Posgrados, piso 1",
        200,
        "200 butacas, escenario con atril, sonido y transmisión. Para eventos académicos e institucionales.",
        ["PROFESORES", "FUNCIONARIOS"],
    ),
    (
        "sala-juntas",
        "Sala de juntas",
        "Sala de reuniones",
        "Edificio administrativo, piso 4",
        12,
        "Mesa para 12 personas con videoconferencia. Para reuniones de dependencias.",
        ["FUNCIONARIOS"],
    ),
    (
        "coliseo",
        "Coliseo cubierto",
        "Deportivo",
        "Zona deportiva",
        300,
        "Cancha múltiple de baloncesto y voleibol con graderías. Para entrenamientos y torneos internos.",
        ["ESTUDIANTES", "FUNCIONARIOS"],
    ),
    (
        "innovacion",
        "Laboratorio de innovación",
        "Laboratorio",
        "Bloque de Ingenierías, piso 1",
        20,
        "Impresoras 3D, herramientas y mesas de trabajo para prototipos y proyectos de curso.",
        ["ESTUDIANTES", "PROFESORES", "CATEDRÁTICOS"],
    ),
]


def hoy() -> date:
    return datetime.now(ZONA).date()


def hora_actual() -> int:
    return datetime.now(ZONA).hour


async def asegurar_espacios(db: AsyncSession) -> bool:
    """La primera vez (tabla vacía y catálogo ya cargado) crea los espacios del campus."""
    if await db.scalar(select(func.count()).select_from(Espacio)):
        return False
    roles = {r.codigo_normalizado: r for r in (await db.scalars(select(Rol))).all()}
    if not roles:
        return False
    for codigo, nombre, tipo, ubicacion, capacidad, descripcion, permitidos in ESPACIOS_INICIALES:
        db.add(
            Espacio(
                codigo=codigo,
                nombre=nombre,
                tipo=tipo,
                ubicacion=ubicacion,
                capacidad=capacidad,
                descripcion=descripcion,
                roles=[roles[normalizar(c)] for c in permitidos if normalizar(c) in roles],
            )
        )
    try:
        await db.commit()
    except IntegrityError:  # otra petición los creó al mismo tiempo
        await db.rollback()
        return False
    return True


def roles_que_habilitan(espacio: Espacio, evaluacion: Evaluacion) -> list[str]:
    """Roles de la persona (que dan acceso) que además están permitidos en el espacio."""
    permitidos = {r.codigo_normalizado for r in espacio.roles if r.activo}
    return [r.codigo for r in evaluacion.roles if r.da_acceso and normalizar(r.codigo) in permitidos]


def motivo_no_puede(espacio: Espacio, habilitan: list[str]) -> str | None:
    if not espacio.activo:
        return "El espacio no está disponible por ahora."
    if not habilitan:
        permitidos = ", ".join(r.codigo for r in espacio.roles if r.activo) or "ningún rol"
        return f"Solo lo pueden reservar: {permitidos}."
    return None


async def validar_reserva(
    db: AsyncSession,
    espacio: Espacio,
    usuario_id: int,
    fecha: date,
    inicio: int,
    fin: int,
    asistentes: int,
) -> str | None:
    """Devuelve el motivo por el que la reserva no se puede hacer, o None si se puede."""
    if not (HORA_APERTURA <= inicio < fin <= HORA_CIERRE):
        return f"El horario debe estar entre las {HORA_APERTURA}:00 y las {HORA_CIERRE}:00."
    if fin - inicio > MAX_HORAS:
        return f"Una reserva puede durar máximo {MAX_HORAS} horas."
    if fecha < hoy() or (fecha == hoy() and inicio <= hora_actual()):
        return "No puedes reservar en el pasado."
    if fecha > hoy() + timedelta(days=DIAS_ADELANTE):
        return f"Solo se puede reservar hasta {DIAS_ADELANTE} días adelante."
    if asistentes > espacio.capacidad:
        return f"El espacio tiene capacidad para {espacio.capacidad} personas."

    activas = Reserva.estado == EstadoReserva.ACTIVA
    cruza = (Reserva.fecha == fecha) & (Reserva.hora_inicio < fin) & (Reserva.hora_fin > inicio)
    if await db.scalar(select(Reserva.id).where(activas, cruza, Reserva.espacio_id == espacio.id).limit(1)):
        return "Ese horario ya está reservado. Elige otra franja."
    if await db.scalar(select(Reserva.id).where(activas, cruza, Reserva.usuario_id == usuario_id).limit(1)):
        return "Ya tienes otra reserva que se cruza con ese horario."
    futuras = await db.scalar(
        select(func.count())
        .select_from(Reserva)
        .where(activas, Reserva.usuario_id == usuario_id, Reserva.fecha >= hoy())
    )
    if (futuras or 0) >= MAX_RESERVAS_FUTURAS:
        return f"Puedes tener máximo {MAX_RESERVAS_FUTURAS} reservas pendientes. Cancela una para hacer otra."
    return None
