import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Import models so Base.metadata is populated
from api.models import Base  # noqa: F401

config = context.config
fileConfig(config.config_file_name)  # type: ignore[arg-type]

# Use DATABASE_URL from environment, stripping the asyncpg driver for sync Alembic
database_url = os.environ["DATABASE_URL"].replace("+asyncpg", "+psycopg")
config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


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


run_migrations_online()
