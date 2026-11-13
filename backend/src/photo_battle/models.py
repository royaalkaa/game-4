from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from photo_battle.db import Base, UTCDateTime


class BattleStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    FINISHED = "finished"
    STOPPED = "stopped"


class RoundState(StrEnum):
    RUNNING = "running"
    BREAK = "break"


class MatchStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    FINISHED = "finished"


class DecidedBy(StrEnum):
    VOTES = "votes"
    TIE = "tie"
    LOT = "lot"
    REMOVAL = "removal"
    BYE = "bye"


def _enum(enum_cls: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        length=16,
        values_callable=lambda members: [member.value for member in members],
    )


class Battle(Base):
    __tablename__ = "battles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(80))
    theme: Mapped[str] = mapped_column(String(120))
    status: Mapped[BattleStatus] = mapped_column(_enum(BattleStatus, "battle_status"))
    round_seconds: Mapped[int] = mapped_column(Integer)
    freeze_seconds: Mapped[int] = mapped_column(Integer)
    auto_advance: Mapped[bool] = mapped_column(Boolean)
    total_rounds: Mapped[int | None] = mapped_column(Integer)
    current_round: Mapped[int | None] = mapped_column(Integer)
    round_state: Mapped[RoundState | None] = mapped_column(_enum(RoundState, "round_state"))
    round_ends_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    battle_id: Mapped[int] = mapped_column(ForeignKey("battles.id"), index=True)
    file_key: Mapped[str] = mapped_column(String(32), unique=True)
    caption: Mapped[str | None] = mapped_column(String(80))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("battle_id", "round", "slot"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    battle_id: Mapped[int] = mapped_column(ForeignKey("battles.id"), index=True)
    round: Mapped[int] = mapped_column(Integer)
    slot: Mapped[int] = mapped_column(Integer)
    status: Mapped[MatchStatus] = mapped_column(_enum(MatchStatus, "match_status"))
    photo_a_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id"))
    photo_b_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id"))
    starts_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    ends_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    winner_id: Mapped[int | None] = mapped_column(ForeignKey("photos.id"))
    decided_by: Mapped[DecidedBy | None] = mapped_column(_enum(DecidedBy, "decided_by"))


class JoinCode(Base):
    __tablename__ = "join_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    battle_id: Mapped[int] = mapped_column(ForeignKey("battles.id"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    valid_until: Mapped[datetime] = mapped_column(UTCDateTime)


class Voter(Base):
    __tablename__ = "voters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    battle_id: Mapped[int] = mapped_column(ForeignKey("battles.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("match_id", "voter_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), index=True)
    voter_id: Mapped[int] = mapped_column(ForeignKey("voters.id"))
    photo_id: Mapped[int] = mapped_column(ForeignKey("photos.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
