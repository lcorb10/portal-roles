"""Tablas de la aplicación (SQLAlchemy 2, estilo tipado)."""

from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text, func
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
