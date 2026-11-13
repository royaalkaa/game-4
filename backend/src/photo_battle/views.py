"""Сборка ответов API по типам из API.md."""

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from photo_battle.models import (
    Battle,
    BattleStatus,
    Match,
    MatchStatus,
    Photo,
    RoundState,
    Vote,
    Voter,
)


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def photo_view(photo: Photo, *, show_caption: bool) -> dict[str, Any]:
    return {
        "id": photo.id,
        "url": f"/media/{photo.file_key}.jpg",
        "caption": photo.caption if show_caption else None,
        "width": photo.width,
        "height": photo.height,
    }


def is_frozen(battle: Battle, now: datetime) -> bool:
    return (
        battle.status == BattleStatus.ACTIVE
        and battle.round_state == RoundState.RUNNING
        and battle.round_ends_at is not None
        and battle.round_ends_at - now <= timedelta(seconds=battle.freeze_seconds)
    )


def vote_stats(
    db: Session, scope: ColumnElement[bool], voter_id: int | None
) -> tuple[dict[tuple[int, int], int], dict[int, int]]:
    """Счёт по (match_id, photo_id) и голоса зрителя по match_id для матчей из scope."""
    counts = {
        (match_id, photo_id): count
        for match_id, photo_id, count in db.execute(
            select(Vote.match_id, Vote.photo_id, func.count())
            .join(Match, Match.id == Vote.match_id)
            .where(scope)
            .group_by(Vote.match_id, Vote.photo_id)
        )
    }
    my_votes: dict[int, int] = {}
    if voter_id is not None:
        my_votes = {
            match_id: photo_id
            for match_id, photo_id in db.execute(
                select(Vote.match_id, Vote.photo_id)
                .join(Match, Match.id == Vote.match_id)
                .where(scope, Vote.voter_id == voter_id)
            )
        }
    return counts, my_votes


def match_view(
    match: Match,
    photos: dict[int, Photo],
    counts: dict[tuple[int, int], int],
    my_vote: int | None,
    *,
    admin: bool,
    frozen: bool,
) -> dict[str, Any]:
    finished = match.status == MatchStatus.FINISHED
    votes_a = counts.get((match.id, match.photo_a_id or 0), 0)
    votes_b = counts.get((match.id, match.photo_b_id or 0), 0)
    visible = (
        admin
        or finished
        or (match.status == MatchStatus.ACTIVE and my_vote is not None and not frozen)
    )
    show_caption = admin or finished

    def photo(photo_id: int | None) -> dict[str, Any] | None:
        if photo_id is None:
            return None
        return photo_view(photos[photo_id], show_caption=show_caption)

    return {
        "id": match.id,
        "round": match.round,
        "slot": match.slot,
        "status": match.status.value,
        "photo_a": photo(match.photo_a_id),
        "photo_b": photo(match.photo_b_id),
        "ends_at": iso(match.ends_at),
        "winner_id": match.winner_id,
        "decided_by": match.decided_by.value if match.decided_by else None,
        "total_votes": votes_a + votes_b,
        "votes_a": votes_a if visible else None,
        "votes_b": votes_b if visible else None,
        "my_vote": my_vote,
    }


def _battle_photos(db: Session, battle: Battle) -> dict[int, Photo]:
    return {
        photo.id: photo
        for photo in db.scalars(
            select(Photo).where(Photo.battle_id == battle.id).order_by(Photo.id)
        )
    }


def single_match_view(
    db: Session, battle: Battle, match: Match, voter_id: int | None, now: datetime
) -> dict[str, Any]:
    counts, my_votes = vote_stats(db, Match.id == match.id, voter_id)
    photos = {
        photo.id: photo
        for photo in db.scalars(
            select(Photo).where(Photo.id.in_([match.photo_a_id, match.photo_b_id]))
        )
    }
    return match_view(
        match,
        photos,
        counts,
        my_votes.get(match.id),
        admin=False,
        frozen=is_frozen(battle, now),
    )


def bracket_view(
    db: Session, battle: Battle, voter_id: int | None, now: datetime, *, admin: bool
) -> dict[str, Any]:
    photos = _battle_photos(db, battle)
    counts, my_votes = vote_stats(db, Match.battle_id == battle.id, voter_id)
    frozen = is_frozen(battle, now)
    rounds: dict[int, list[dict[str, Any]]] = {}
    matches = db.scalars(
        select(Match).where(Match.battle_id == battle.id).order_by(Match.round, Match.slot)
    )
    for match in matches:
        rounds.setdefault(match.round, []).append(
            match_view(match, photos, counts, my_votes.get(match.id), admin=admin, frozen=frozen)
        )
    return {"rounds": [{"round": number, "matches": items} for number, items in rounds.items()]}


def battle_view(db: Session, battle: Battle, voter_id: int | None, now: datetime) -> dict[str, Any]:
    winner = None
    if battle.status == BattleStatus.FINISHED:
        winner = db.scalar(
            select(Photo)
            .join(Match, Match.winner_id == Photo.id)
            .where(
                Match.battle_id == battle.id,
                Match.round == battle.total_rounds,
                Match.slot == 0,
            )
        )
    return {
        "id": battle.id,
        "title": battle.title,
        "theme": battle.theme,
        "status": battle.status.value,
        "round_state": battle.round_state.value if battle.round_state else None,
        "current_round": battle.current_round,
        "total_rounds": battle.total_rounds,
        "round_ends_at": iso(battle.round_ends_at),
        "frozen": is_frozen(battle, now),
        "winner": photo_view(winner, show_caption=True) if winner is not None else None,
        "joined": voter_id is not None,
        "server_time": iso(now),
    }


def admin_battle_view(
    db: Session, battle: Battle, voter_id: int | None, now: datetime
) -> dict[str, Any]:
    voters = db.scalar(select(func.count()).select_from(Voter).where(Voter.battle_id == battle.id))
    return {
        **battle_view(db, battle, voter_id, now),
        "round_seconds": battle.round_seconds,
        "freeze_seconds": battle.freeze_seconds,
        "auto_advance": battle.auto_advance,
        "photos": [
            photo_view(photo, show_caption=True) for photo in _battle_photos(db, battle).values()
        ],
        "bracket": bracket_view(db, battle, voter_id, now, admin=True),
        "voters": voters,
    }
