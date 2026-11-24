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
        assert context.get_current_revision() == "0003"
    engine.dispose()


def test_migrations_form_single_linear_chain() -> None:
    scripts = ScriptDirectory.from_config(alembic_config("sqlite://"))
    assert len(scripts.get_heads()) == 1
    assert len(scripts.get_bases()) == 1


def test_swipe_migration_runs_on_db_with_duel_data(tmp_path) -> None:
    # SQLite с включёнными внешними ключами не даёт пересоздать photos, на которые
    # ссылаются матчи, поэтому 0002 проверяется на базе с данными, а не на пустой.
    url = "sqlite:///" + (tmp_path / "filled.db").as_posix()
    config = alembic_config(url)
    command.upgrade(config, "0001")
    engine = make_engine(url)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "INSERT INTO battles (id, title, theme, status, round_seconds, freeze_seconds,"
            " auto_advance, created_at) VALUES (1, 'b', '', 'active', 60, 0, 0, '2026-11-13')"
        )
        connection.exec_driver_sql(
            "INSERT INTO photos (id, battle_id, file_key, width, height, created_at)"
            " VALUES (1, 1, 'k1', 10, 10, '2026-11-13'), (2, 1, 'k2', 10, 10, '2026-11-13')"
        )
        connection.exec_driver_sql(
            "INSERT INTO matches (id, battle_id, round, slot, status, photo_a_id, photo_b_id)"
            " VALUES (1, 1, 1, 0, 'active', 1, 2)"
        )
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT mode FROM battles").scalar() == "duel"
        assert connection.exec_driver_sql("SELECT COUNT(*) FROM photos").scalar() == 2
    engine.dispose()
