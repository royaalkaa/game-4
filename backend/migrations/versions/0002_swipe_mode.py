"""Режим свайпов: фото от гостей и голоса да/нет.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, length=16)


def _time() -> sa.DateTime:
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    # Колонки добавляются обычным ADD COLUMN без пересборки таблиц: при включённых
    # внешних ключах SQLite не даёт пересоздать photos, на которые ссылаются матчи.
    op.add_column(
        "battles",
        sa.Column(
            "mode", _enum("battle_mode", "duel", "swipe"), server_default="duel", nullable=False
        ),
    )
    op.add_column(
        "battles", sa.Column("phase", _enum("swipe_phase", "collecting", "voting"), nullable=True)
    )
    if op.get_bind().dialect.name == "sqlite":
        # SQLite не добавляет внешний ключ отдельной командой, только вместе с колонкой.
        op.execute("ALTER TABLE photos ADD COLUMN voter_id INTEGER REFERENCES voters (id)")
    else:
        op.add_column("photos", sa.Column("voter_id", sa.Integer(), nullable=True))
        op.create_foreign_key("fk_photos_voter_id_voters", "photos", "voters", ["voter_id"], ["id"])
    op.add_column("photos", sa.Column("removed_at", _time(), nullable=True))
    op.create_table(
        "swipes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("photo_id", sa.Integer(), nullable=False),
        sa.Column("voter_id", sa.Integer(), nullable=False),
        sa.Column("liked", sa.Boolean(), nullable=False),
        sa.Column("created_at", _time(), nullable=False),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"]),
        sa.ForeignKeyConstraint(["voter_id"], ["voters.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("photo_id", "voter_id"),
    )
    op.create_index("ix_swipes_photo_id", "swipes", ["photo_id"])


def downgrade() -> None:
    op.drop_table("swipes")
    with op.batch_alter_table("photos") as batch:
        batch.drop_column("removed_at")
        batch.drop_column("voter_id")
    with op.batch_alter_table("battles") as batch:
        batch.drop_column("phase")
        batch.drop_column("mode")
