"""Начальная схема.

Revision ID: 0001
Revises:
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, length=16)


def _time() -> sa.DateTime:
    return sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", _time(), nullable=False),
        sa.Column("expires_at", _time(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_table(
        "battles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("theme", sa.String(length=120), nullable=False),
        sa.Column(
            "status",
            _enum("battle_status", "draft", "active", "finished", "stopped"),
            nullable=False,
        ),
        sa.Column("round_seconds", sa.Integer(), nullable=False),
        sa.Column("freeze_seconds", sa.Integer(), nullable=False),
        sa.Column("auto_advance", sa.Boolean(), nullable=False),
        sa.Column("total_rounds", sa.Integer(), nullable=True),
        sa.Column("current_round", sa.Integer(), nullable=True),
        sa.Column("round_state", _enum("round_state", "running", "break"), nullable=True),
        sa.Column("round_ends_at", _time(), nullable=True),
        sa.Column("created_at", _time(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "join_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("battle_id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("valid_until", _time(), nullable=False),
        sa.ForeignKeyConstraint(["battle_id"], ["battles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_join_codes_battle_id", "join_codes", ["battle_id"])
    op.create_table(
        "photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("battle_id", sa.Integer(), nullable=False),
        sa.Column("file_key", sa.String(length=32), nullable=False),
        sa.Column("caption", sa.String(length=80), nullable=True),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("created_at", _time(), nullable=False),
        sa.ForeignKeyConstraint(["battle_id"], ["battles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("file_key"),
    )
    op.create_index("ix_photos_battle_id", "photos", ["battle_id"])
    op.create_table(
        "voters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("battle_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", _time(), nullable=False),
        sa.ForeignKeyConstraint(["battle_id"], ["battles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_voters_battle_id", "voters", ["battle_id"])
    op.create_table(
        "matches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("battle_id", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("slot", sa.Integer(), nullable=False),
        sa.Column("status", _enum("match_status", "pending", "active", "finished"), nullable=False),
        sa.Column("photo_a_id", sa.Integer(), nullable=True),
        sa.Column("photo_b_id", sa.Integer(), nullable=True),
        sa.Column("starts_at", _time(), nullable=True),
        sa.Column("ends_at", _time(), nullable=True),
        sa.Column("winner_id", sa.Integer(), nullable=True),
        sa.Column(
            "decided_by",
            _enum("decided_by", "votes", "tie", "lot", "removal", "bye"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["battle_id"], ["battles.id"]),
        sa.ForeignKeyConstraint(["photo_a_id"], ["photos.id"]),
        sa.ForeignKeyConstraint(["photo_b_id"], ["photos.id"]),
        sa.ForeignKeyConstraint(["winner_id"], ["photos.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("battle_id", "round", "slot"),
    )
    op.create_index("ix_matches_battle_id", "matches", ["battle_id"])
    op.create_table(
        "votes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("match_id", sa.Integer(), nullable=False),
        sa.Column("voter_id", sa.Integer(), nullable=False),
        sa.Column("photo_id", sa.Integer(), nullable=False),
        sa.Column("created_at", _time(), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"]),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"]),
        sa.ForeignKeyConstraint(["voter_id"], ["voters.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id", "voter_id"),
    )
    op.create_index("ix_votes_match_id", "votes", ["match_id"])


def downgrade() -> None:
    op.drop_table("votes")
    op.drop_table("matches")
    op.drop_table("voters")
    op.drop_table("photos")
    op.drop_table("join_codes")
    op.drop_table("battles")
    op.drop_table("admin_sessions")
