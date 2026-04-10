import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Import models so Base.metadata is populated
from backend.src.app.models import Base  # noqa: F401

config = context.config
fileConfig(config.config_file_name)  # type: ignore[arg-type]

target_metadata = Base.metadata

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("WARNING: DATABASE_URL not set — skipping migrations")
elif database_url.startswith("sqlite"):
    # SQLite dev DB: use create_all via init_db, not Alembic
    print("INFO: SQLite detected — skipping Alembic migrations (use init_db instead)")
    database_url = None
else:
    # PostgreSQL: swap asyncpg driver for sync psycopg used by Alembic
    database_url = database_url.replace("+asyncpg", "+psycopg")
    config.set_main_option("sqlalchemy.url", database_url)


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),  # type: ignore[arg-type]
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if database_url:
    run_migrations_online()
