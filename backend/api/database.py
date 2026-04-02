from collections.abc import AsyncGenerator

from fastapi import HTTPException
from pydantic_settings import BaseSettings
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool


class Settings(BaseSettings):
    database_url: str | None = None

    model_config = {"env_file": ".env"}


settings = Settings()

_engine: AsyncEngine | None = None
_AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None

if settings.database_url:
    if settings.database_url.startswith("sqlite"):
        _engine = create_async_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        _engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=0,
        )
    _AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)

engine = _engine


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables. Used for SQLite dev — production uses Alembic migrations."""
    assert _engine is not None
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if _AsyncSessionLocal is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    async with _AsyncSessionLocal() as session:
        yield session
