"""Tablas de la aplicación (SQLAlchemy 2, estilo tipado)."""

from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Table, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def ahora() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Perfil(StrEnum):
    ADMINISTRADOR = "ADMINISTRADOR"
    CONSULTANTE = "CONSULTANTE"


class Origen(StrEnum):
    CREADO_POR_ADMIN = "CREADO_POR_ADMIN"
    REGISTRO_AUTOMATICO = "REGISTRO_AUTOMATICO"


# Roles que un administrador le asignó a cada usuario. Un rol asignado no se puede borrar (RESTRICT).
usuario_roles = Table(
    "usuario_roles",
    Base.metadata,
    Column("usuario_id", ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True),
    Column("rol_id", ForeignKey("roles.id", ondelete="RESTRICT"), primary_key=True),
)


class Rol(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(60), unique=True)
    # Código sin tildes, en minúsculas y sin espacios en los extremos: garantiza la unicidad
    # "CATEDRÁTICOS" == "Catedraticos" == " catedráticos ".
    codigo_normalizado: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    descripcion: Mapped[str] = mapped_column(Text, default="")
    activo: Mapped[bool] = mapped_column(default=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    correo: Mapped[str] = mapped_column(String(160))
    perfil: Mapped[str] = mapped_column(String(20), default=Perfil.CONSULTANTE)
    activo: Mapped[bool] = mapped_column(default=True)
    origen: Mapped[str] = mapped_column(String(30))
    ultimo_ingreso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    roles: Mapped[list[Rol]] = relationship(secondary=usuario_roles, lazy="selectin", order_by=Rol.codigo)


class Auditoria(Base):
    """Registro de quién cambió qué y cuándo (extra opcional de la prueba)."""

    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora, server_default=func.now())
    actor: Mapped[str] = mapped_column(String(60))
    accion: Mapped[str] = mapped_column(String(40))
    detalle: Mapped[str] = mapped_column(Text)


# ── Reserva de espacios ─────────────────────────────────────────────────────────────────

# Roles que pueden reservar cada espacio. Si se elimina un rol del catálogo, deja de habilitar el espacio.
espacio_roles = Table(
    "espacio_roles",
    Base.metadata,
    Column("espacio_id", ForeignKey("espacios.id", ondelete="CASCADE"), primary_key=True),
    Column("rol_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class EstadoReserva(StrEnum):
    ACTIVA = "ACTIVA"
    CANCELADA = "CANCELADA"


class Espacio(Base):
    __tablename__ = "espacios"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), unique=True)  # también nombra la foto del frontend
    nombre: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(40))
    ubicacion: Mapped[str] = mapped_column(String(120))
    capacidad: Mapped[int] = mapped_column(Integer)
    descripcion: Mapped[str] = mapped_column(Text, default="")
    activo: Mapped[bool] = mapped_column(default=True)

    roles: Mapped[list[Rol]] = relationship(secondary=espacio_roles, lazy="selectin", order_by=Rol.id)


class Reserva(Base):
    __tablename__ = "reservas"

    id: Mapped[int] = mapped_column(primary_key=True)
    espacio_id: Mapped[int] = mapped_column(ForeignKey("espacios.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    hora_inicio: Mapped[int] = mapped_column(SmallInteger)  # 7..20
    hora_fin: Mapped[int] = mapped_column(SmallInteger)  # 8..21 (exclusiva)
    motivo: Mapped[str] = mapped_column(String(200))
    asistentes: Mapped[int] = mapped_column(Integer, default=1)
    estado: Mapped[str] = mapped_column(String(12), default=EstadoReserva.ACTIVA)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    cancelada_por: Mapped[str | None] = mapped_column(String(60))

    espacio: Mapped[Espacio] = relationship(lazy="selectin")
    usuario: Mapped[Usuario] = relationship(lazy="selectin")
