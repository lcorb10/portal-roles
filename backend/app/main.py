import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware

from app.config import Settings
from app.datamock import DataMockClient, ServicioNoDisponible
from app.db import crear_engine, crear_sessionmaker
from app.models import Base
from app.routers import admin_roles, admin_usuarios, asistente, auth
from app.servicios import asegurar_catalogo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("portal")


async def cargar_catalogo_con_reintentos(app: FastAPI, intentos: int = 15) -> None:
    """dataMock puede tardar un poco en arrancar. Si no carga aquí, se reintenta en el primer login."""
    for intento in range(1, intentos + 1):
        try:
            async with app.state.sessionmaker() as db:
                await asegurar_catalogo(db, app.state.datamock)
            return
        except ServicioNoDisponible:
            log.warning("dataMock aún no responde (intento %s/%s)", intento, intentos)
            await asyncio.sleep(2)


def create_app(settings: Settings | None = None, datamock: DataMockClient | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = crear_engine(settings.database_url)
        async with engine.begin() as conexion:
            await conexion.run_sync(Base.metadata.create_all)
        app.state.settings = settings
        app.state.engine = engine
        app.state.sessionmaker = crear_sessionmaker(engine)
        app.state.datamock = datamock or DataMockClient(settings)
        tarea = asyncio.create_task(cargar_catalogo_con_reintentos(app))
        try:
            yield
        finally:
            tarea.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await tarea
            await app.state.datamock.aclose()
            await engine.dispose()

    app = FastAPI(
        title="Portal de Roles",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="portal_sesion",
        max_age=settings.sesion_horas * 3600,
        same_site="lax",
        https_only=settings.sesion_solo_https,
    )

    @app.get("/api/health", tags=["salud"])
    async def health(request: Request) -> dict[str, str]:
        try:
            async with request.app.state.engine.connect() as conexion:
                await conexion.execute(text("SELECT 1"))
            db = "ok"
        except Exception:  # noqa: BLE001 — el healthcheck solo informa
            db = "sin conexión"
        return {"estado": "ok", "base_de_datos": db}

    for modulo in (auth, admin_roles, admin_usuarios, asistente):
        app.include_router(modulo.router)
    return app


def __getattr__(nombre: str) -> FastAPI:
    # `app` se crea al pedirlo (fastapi run / uvicorn), así importar el módulo en las
    # pruebas no exige un .env.
    if nombre == "app":
        global app
        app = create_app()
        return app
    raise AttributeError(nombre)
