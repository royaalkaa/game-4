from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory

from photo_battle import models  # noqa: F401
from photo_battle.db import Base, make_engine

BACKEND = Path(__file__).resolve().parent.parent


def alembic_config(url: str) -> Config:
    config = Config(BACKEND / "alembic.ini")
    config.set_main_option("sqlalchemy.url", url)
    config.attributes["configure_logger"] = False
    return config


def test_migration_on_clean_db_matches_models(tmp_path) -> None:
    url = "sqlite:///" + (tmp_path / "migrated.db").as_posix()
    command.upgrade(alembic_config(url), "head")

    engine = make_engine(url)
    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        assert compare_metadata(context, Base.metadata) == []
        assert context.get_current_revision() == "0001"
    engine.dispose()


def test_migrations_form_single_linear_chain() -> None:
    scripts = ScriptDirectory.from_config(alembic_config("sqlite://"))
    assert len(scripts.get_heads()) == 1
    assert len(scripts.get_bases()) == 1
