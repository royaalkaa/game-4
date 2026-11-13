from typing import Any

import structlog
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from photo_battle import clock, game, views
from photo_battle.deps import (
    DbSession,
    SettingsDep,
    digest,
    find_voter,
    set_cookie,
    voter_cookie,
)
from photo_battle.errors import ApiError, not_found
from photo_battle.models import (
    Battle,
    BattleStatus,
    JoinCode,
    Match,
    MatchStatus,
    RoundState,
    Vote,
    Voter,
)
from photo_battle.security import new_token

log = structlog.get_logger()
router = APIRouter(prefix="/api")

VOTER_COOKIE_MAX_AGE = 7 * 24 * 3600


class JoinIn(BaseModel):
    code: str = Field(max_length=64)


class VoteIn(BaseModel):
    photo_id: int


def _not_joined() -> ApiError:
    return ApiError(401, "not_joined", "Отсканируйте QR-код на экране зала, чтобы голосовать.")


def _public_battle(db: Session, battle_id: int) -> Battle:
    battle = db.get(Battle, battle_id)
    if battle is None or battle.status == BattleStatus.DRAFT:
        raise not_found()
    game.close_if_due(db, battle)
    return battle


@router.get("/battles/{battle_id}")
def get_battle(
    battle_id: int, request: Request, db: DbSession, settings: SettingsDep
) -> dict[str, Any]:
    battle = _public_battle(db, battle_id)
    voter = find_voter(request, db, settings, battle.id)
    return views.battle_view(db, battle, voter.id if voter else None, clock.now())


@router.get("/battles/{battle_id}/bracket")
def get_bracket(
    battle_id: int, request: Request, db: DbSession, settings: SettingsDep
) -> dict[str, Any]:
    battle = _public_battle(db, battle_id)
    voter = find_voter(request, db, settings, battle.id)
    return views.bracket_view(db, battle, voter.id if voter else None, clock.now(), admin=False)


@router.get("/battles/{battle_id}/next-match")
def get_next_match(
    battle_id: int, request: Request, db: DbSession, settings: SettingsDep
) -> dict[str, Any]:
    battle = _public_battle(db, battle_id)
    voter = find_voter(request, db, settings, battle.id)
    if voter is None:
        raise _not_joined()
    now = clock.now()
    if battle.status != BattleStatus.ACTIVE or battle.round_state != RoundState.RUNNING:
        return {"match": None}
    match = db.scalar(
        select(Match)
        .where(
            Match.battle_id == battle.id,
            Match.round == battle.current_round,
            Match.status == MatchStatus.ACTIVE,
            Match.photo_b_id.is_not(None),
            Match.ends_at > now,
            ~exists().where(Vote.match_id == Match.id, Vote.voter_id == voter.id),
        )
        .order_by(Match.slot)
        .limit(1)
    )
    if match is None:
        return {"match": None}
    return {"match": views.single_match_view(db, battle, match, voter.id, now)}


@router.post("/battles/{battle_id}/join")
def join_battle(
    battle_id: int,
    body: JoinIn,
    request: Request,
    response: Response,
    db: DbSession,
    settings: SettingsDep,
) -> dict[str, bool]:
    battle = _public_battle(db, battle_id)
    if battle.status != BattleStatus.ACTIVE:
        raise ApiError(409, "battle_closed", "Голосование в этом батле закрыто.")
    if find_voter(request, db, settings, battle.id) is not None:
        return {"ok": True}
    now = clock.now()
    code_ok = db.scalar(
        select(JoinCode.id).where(
            JoinCode.battle_id == battle.id,
            JoinCode.code_hash == digest(settings, body.code),
            JoinCode.valid_until > now,
        )
    )
    if code_ok is None:
        raise ApiError(400, "code_invalid", "Код устарел. Отсканируйте QR-код на экране ещё раз.")
    token = new_token()
    voter = Voter(battle_id=battle.id, token_hash=digest(settings, token), created_at=now)
    db.add(voter)
    db.commit()
    set_cookie(response, settings, voter_cookie(battle.id), token, VOTER_COOKIE_MAX_AGE)
    log.info("voter_joined", battle_id=battle.id, voter_id=voter.id)
    return {"ok": True}


@router.post("/matches/{match_id}/vote")
def vote(
    match_id: int, body: VoteIn, request: Request, db: DbSession, settings: SettingsDep
) -> dict[str, Any]:
    match = db.get(Match, match_id)
    if match is None:
        raise not_found()
    battle = db.get(Battle, match.battle_id)
    if battle is None or battle.status == BattleStatus.DRAFT:
        raise not_found()
    voter = find_voter(request, db, settings, battle.id)
    if voter is None:
        raise _not_joined()
    game.close_if_due(db, battle)
    with game.LOCK:
        db.refresh(battle)
        db.refresh(match)
        now = clock.now()
        if (
            battle.status != BattleStatus.ACTIVE
            or match.status != MatchStatus.ACTIVE
            or match.ends_at is None
            or now >= match.ends_at
        ):
            raise ApiError(409, "match_closed", "Голосование в этой дуэли уже закончилось.")
        if body.photo_id not in (match.photo_a_id, match.photo_b_id):
            raise ApiError(400, "bad_photo", "Этого фото нет в дуэли.")
        db.add(Vote(match_id=match.id, voter_id=voter.id, photo_id=body.photo_id, created_at=now))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ApiError(409, "already_voted", "Вы уже голосовали в этой дуэли.") from None
    log.info("vote_cast", battle_id=battle.id, match_id=match.id, voter_id=voter.id)
    return views.single_match_view(db, battle, match, voter.id, now)
