from collections.abc import AsyncGenerator

from fastapi import HTTPException
from pydantic_settings import BaseSettings
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Settings(BaseSettings):
    database_url: str | None = None

    model_config = {"env_file": ".env"}


settings = Settings()

_engine = None
_AsyncSessionLocal = None

if settings.database_url:
    _engine = create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=0,
    )
    _AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if _AsyncSessionLocal is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    async with _AsyncSessionLocal() as session:
        yield session
