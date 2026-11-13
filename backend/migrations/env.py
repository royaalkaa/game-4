from logging.config import fileConfig

from alembic import context

from photo_battle import models  # noqa: F401  регистрирует таблицы в Base.metadata
from photo_battle.config import DatabaseSettings
from photo_battle.db import Base, make_engine

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

# Тесты передают адрес БД через sqlalchemy.url, остальные запуски берут DATABASE_URL.
url = config.get_main_option("sqlalchemy.url") or DatabaseSettings().database_url

engine = make_engine(url)
with engine.connect() as connection:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
