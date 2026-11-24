import hashlib
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Form, Request, Response, UploadFile
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from photo_battle import api_admin, clock, game, views
from photo_battle.config import Settings
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
    BattleMode,
    BattleStatus,
    JoinCode,
    Match,
    MatchStatus,
    Photo,
    RoundState,
    Swipe,
    SwipePhase,
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


class SwipeIn(BaseModel):
    liked: bool


GuestName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


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


def _joined_voter(request: Request, db: Session, settings: Settings, battle: Battle) -> Voter:
    voter = find_voter(request, db, settings, battle.id)
    if voter is None:
        raise _not_joined()
    return voter


def _swipe_battle(db: Session, battle_id: int) -> Battle:
    battle = _public_battle(db, battle_id)
    if battle.mode != BattleMode.SWIPE:
        raise not_found()
    return battle


def _collecting_closed() -> ApiError:
    return ApiError(409, "collecting_closed", "Приём фото закрыт.")


@router.post("/battles/{battle_id}/my-photo")
def upload_my_photo(
    battle_id: int,
    file: UploadFile,
    name: Annotated[GuestName, Form()],
    request: Request,
    db: DbSession,
    settings: SettingsDep,
) -> dict[str, Any]:
    battle = _swipe_battle(db, battle_id)
    voter = _joined_voter(request, db, settings, battle)
    if battle.phase != SwipePhase.COLLECTING:
        raise _collecting_closed()
    current = views.my_photo_of(db, battle, voter.id)
    # Повторная загрузка заменяет фото гостя: одно фото на человека.
    if current is None and api_admin.live_photo_count(db, battle) >= api_admin.MAX_SWIPE_PHOTOS:
        raise ApiError(409, "too_many_photos", "Мест для фото больше нет.")
    stored = api_admin.store_upload(file, settings.media_dir)
    old_key = current.file_key if current is not None else None
    with game.LOCK:
        db.refresh(battle)
        if battle.phase != SwipePhase.COLLECTING:
            (settings.media_dir / f"{stored.file_key}.jpg").unlink(missing_ok=True)
            raise _collecting_closed()
        if current is None:
            current = Photo(battle_id=battle.id, voter_id=voter.id, created_at=clock.now())
            db.add(current)
        current.file_key = stored.file_key
        current.caption = name
        current.width = stored.width
        current.height = stored.height
        db.commit()
    if old_key is not None:
        (settings.media_dir / f"{old_key}.jpg").unlink(missing_ok=True)
    log.info("guest_photo_uploaded", battle_id=battle.id, photo_id=current.id)
    return views.photo_view(current, show_caption=True)


@router.delete("/battles/{battle_id}/my-photo")
def delete_my_photo(
    battle_id: int, request: Request, db: DbSession, settings: SettingsDep
) -> dict[str, bool]:
    battle = _swipe_battle(db, battle_id)
    voter = _joined_voter(request, db, settings, battle)
    with game.LOCK:
        db.refresh(battle)
        if battle.phase != SwipePhase.COLLECTING:
            raise _collecting_closed()
        photo = views.my_photo_of(db, battle, voter.id)
        if photo is None:
            raise not_found()
        file_path = settings.media_dir / f"{photo.file_key}.jpg"
        db.delete(photo)
        db.commit()
    file_path.unlink(missing_ok=True)
    log.info("guest_photo_deleted", battle_id=battle.id)
    return {"ok": True}


def _voting_open(battle: Battle) -> bool:
    return (
        battle.status == BattleStatus.ACTIVE
        and battle.phase == SwipePhase.VOTING
        and battle.round_ends_at is not None
        and clock.now() < battle.round_ends_at
    )


def _deck_order(voter_id: int, photo_id: int) -> str:
    # У каждого гостя свой порядок карточек, иначе первые фото получают больше внимания.
    return hashlib.sha256(f"{voter_id}:{photo_id}".encode()).hexdigest()


@router.get("/battles/{battle_id}/deck")
def get_deck(
    battle_id: int, request: Request, db: DbSession, settings: SettingsDep
) -> dict[str, Any]:
    battle = _swipe_battle(db, battle_id)
    voter = _joined_voter(request, db, settings, battle)
    if not _voting_open(battle):
        return {"photos": [], "total": 0}
    photos = list(
        db.scalars(
            select(Photo).where(
                Photo.battle_id == battle.id,
                Photo.removed_at.is_(None),
                Photo.voter_id.is_distinct_from(voter.id),
            )
        )
    )
    swiped = set(
        db.scalars(
            select(Swipe.photo_id).where(
                Swipe.voter_id == voter.id, Swipe.photo_id.in_([p.id for p in photos])
            )
        )
    )
    left = sorted(
        (photo for photo in photos if photo.id not in swiped),
        key=lambda photo: _deck_order(voter.id, photo.id),
    )
    return {
        "photos": [views.photo_view(photo, show_caption=True) for photo in left],
        "total": len(photos),
    }


@router.post("/photos/{photo_id}/swipe")
def swipe(
    photo_id: int, body: SwipeIn, request: Request, db: DbSession, settings: SettingsDep
) -> dict[str, bool]:
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise not_found()
    battle = db.get(Battle, photo.battle_id)
    if battle is None or battle.mode != BattleMode.SWIPE or battle.status == BattleStatus.DRAFT:
        raise not_found()
    voter = _joined_voter(request, db, settings, battle)
    if photo.voter_id == voter.id:
        raise ApiError(403, "own_photo", "За своё фото голосовать нельзя.")
    game.close_if_due(db, battle)
    with game.LOCK:
        db.refresh(battle)
        db.refresh(photo)
        if not _voting_open(battle) or photo.removed_at is not None:
            raise ApiError(409, "voting_closed", "Голосование уже закончилось.")
        db.add(
            Swipe(photo_id=photo.id, voter_id=voter.id, liked=body.liked, created_at=clock.now())
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ApiError(409, "already_swiped", "Ты уже голосовал за это фото.") from None
    log.info("swipe_cast", battle_id=battle.id, photo_id=photo.id, voter_id=voter.id)
    return {"ok": True}


@router.get("/battles/{battle_id}/standings")
def get_standings(battle_id: int, db: DbSession) -> dict[str, Any]:
    battle = _swipe_battle(db, battle_id)
    # Счёт до конца голосования не отдаётся никому, кроме ведущего.
    if battle.status != BattleStatus.FINISHED:
        raise ApiError(409, "not_finished", "Итоги появятся после голосования.")
    return {"entries": [views.standing_view(item) for item in game.standings(db, battle)]}
