from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


def crear_engine(url: str) -> AsyncEngine:
    return create_async_engine(url, pool_pre_ping=True)


def crear_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def obtener_db(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as sesion:
        yield sesion


DbDep = Annotated[AsyncSession, Depends(obtener_db)]
