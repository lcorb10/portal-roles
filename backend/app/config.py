"""Configuración leída del entorno (archivo .env). Ninguna credencial vive en el código."""

from functools import cached_property

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mock_api_url: str = "http://localhost:4000"
    roles_client_id: str
    roles_client_secret: str
    ia_api_key: str
    admin_usernames: str = ""
    session_secret: str = Field(min_length=32)
    database_url: str

    # Si el servicio de roles no responde en este tiempo, no se deja entrar (regla de la sección 6).
    servicio_timeout_segundos: float = 5.0
    # Duración máxima de la sesión (la cookie la firma SESSION_SECRET).
    sesion_horas: int = 8
    # Activar detrás de HTTPS para que la cookie lleve el atributo Secure.
    sesion_solo_https: bool = False

    @cached_property
    def administradores(self) -> frozenset[str]:
        """Usuarios de ADMIN_USERNAMES, sin espacios y en minúsculas."""
        return frozenset(u.strip().lower() for u in self.admin_usernames.split(",") if u.strip())
