import secrets
from datetime import datetime, timedelta
from io import BytesIO
from typing import Annotated, Any

import segno
import structlog
from fastapi import APIRouter, Depends, Form, Request, Response, UploadFile
from pydantic import BaseModel, Field, StringConstraints, model_validator
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from photo_battle import clock, game, images, views
from photo_battle.deps import (
    ADMIN_COOKIE,
    AdminDep,
    DbSession,
    SettingsDep,
    digest,
    find_voter,
    require_admin,
    set_cookie,
)
from photo_battle.errors import ApiError, not_found
from photo_battle.models import (
    AdminSession,
    Battle,
    BattleStatus,
    DecidedBy,
    JoinCode,
    Match,
    MatchStatus,
    Photo,
    RoundState,
)
from photo_battle.security import new_token, verify_admin_password

log = structlog.get_logger()

auth_router = APIRouter(prefix="/api/admin")
router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])

ADMIN_SESSION_TTL = timedelta(hours=12)
LOGIN_WINDOW = timedelta(minutes=10)
LOGIN_MAX_FAILURES = 5
MAX_PHOTOS = 16
MIN_PHOTOS = 2
JOIN_CODE_ROTATE = timedelta(seconds=30)
JOIN_CODE_TTL = timedelta(seconds=60)


class LoginIn(BaseModel):
    password: str = Field(max_length=256)


class BattleIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    theme: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    round_seconds: int = Field(ge=30, le=86400)
    freeze_seconds: int = Field(ge=0)
    auto_advance: bool

    @model_validator(mode="after")
    def _freeze_inside_round(self) -> "BattleIn":
        if self.freeze_seconds >= self.round_seconds:
            raise ValueError("freeze_seconds")
        return self


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@auth_router.post("/login")
def login(
    body: LoginIn, request: Request, response: Response, db: DbSession, settings: SettingsDep
) -> dict[str, bool]:
    state = request.app.state
    client = _client_key(request)
    now = clock.now()
    with state.login_lock:
        recent = [t for t in state.login_failures.get(client, []) if now - t < LOGIN_WINDOW]
        state.login_failures[client] = recent
        if len(recent) >= LOGIN_MAX_FAILURES:
            log.warning("admin_login_throttled")
            raise ApiError(
                429, "too_many_attempts", "Слишком много попыток входа. Подождите 10 минут."
            )
    if not verify_admin_password(body.password, settings.admin_password_hash.get_secret_value()):
        with state.login_lock:
            state.login_failures.setdefault(client, []).append(now)
        log.warning("admin_login_failed")
        raise ApiError(401, "bad_password", "Неверный пароль.")
    token = new_token()
    db.add(
        AdminSession(
            token_hash=digest(settings, token), created_at=now, expires_at=now + ADMIN_SESSION_TTL
        )
    )
    db.commit()
    set_cookie(response, settings, ADMIN_COOKIE, token, int(ADMIN_SESSION_TTL.total_seconds()))
    log.info("admin_login")
    return {"ok": True}


@router.post("/logout")
def logout(
    admin: AdminDep, response: Response, db: DbSession, settings: SettingsDep
) -> dict[str, bool]:
    db.delete(admin)
    db.commit()
    response.delete_cookie(
        ADMIN_COOKIE, path="/", httponly=True, samesite="lax", secure=settings.cookie_secure
    )
    log.info("admin_logout")
    return {"ok": True}


@router.get("/me")
def me() -> dict[str, bool]:
    return {"admin": True}


@router.get("/battles")
def list_battles(db: DbSession) -> list[dict[str, Any]]:
    photo_count = select(func.count(Photo.id)).where(Photo.battle_id == Battle.id).scalar_subquery()
    rows = db.execute(
        select(Battle, photo_count).order_by(Battle.created_at.desc(), Battle.id.desc())
    )
    return [
        {
            "id": battle.id,
            "title": battle.title,
            "theme": battle.theme,
            "status": battle.status.value,
            "photo_count": count,
            "created_at": views.iso(battle.created_at),
        }
        for battle, count in rows
    ]


def _admin_battle(db: Session, battle_id: int) -> Battle:
    battle = db.get(Battle, battle_id)
    if battle is None:
        raise not_found()
    game.close_if_due(db, battle)
    return battle


def _admin_view(request: Request, db: Session, battle: Battle) -> dict[str, Any]:
    voter = find_voter(request, db, request.app.state.settings, battle.id)
    return views.admin_battle_view(db, battle, voter.id if voter else None, clock.now())


@router.post("/battles")
def create_battle(body: BattleIn, request: Request, db: DbSession) -> dict[str, Any]:
    battle = Battle(
        title=body.title,
        theme=body.theme,
        status=BattleStatus.DRAFT,
        round_seconds=body.round_seconds,
        freeze_seconds=body.freeze_seconds,
        auto_advance=body.auto_advance,
        created_at=clock.now(),
    )
    db.add(battle)
    db.commit()
    log.info("battle_created", battle_id=battle.id)
    return _admin_view(request, db, battle)


@router.get("/battles/{battle_id}")
def get_battle(battle_id: int, request: Request, db: DbSession) -> dict[str, Any]:
    return _admin_view(request, db, _admin_battle(db, battle_id))


def _not_draft() -> ApiError:
    return ApiError(409, "not_draft", "Батл уже запущен, менять фото нельзя.")


@router.post("/battles/{battle_id}/photos")
def upload_photo(
    battle_id: int,
    file: UploadFile,
    db: DbSession,
    settings: SettingsDep,
    caption: Annotated[str | None, Form(max_length=80)] = None,
) -> dict[str, Any]:
    battle = _admin_battle(db, battle_id)
    if battle.status != BattleStatus.DRAFT:
        raise _not_draft()
    count = db.scalar(select(func.count(Photo.id)).where(Photo.battle_id == battle.id))
    if count is not None and count >= MAX_PHOTOS:
        raise ApiError(409, "too_many_photos", f"В батле не больше {MAX_PHOTOS} фото.")
    try:
        data = images.read_limited(file.file)
        stored = images.store_image(data, settings.media_dir)
    except images.ImageTooLarge:
        raise ApiError(413, "too_large", "Файл больше 10 МБ.") from None
    except images.ImageRejected:
        raise ApiError(
            400, "bad_image", "Нужна картинка JPEG, PNG или WebP не больше 8000 px по стороне."
        ) from None
    photo = Photo(
        battle_id=battle.id,
        file_key=stored.file_key,
        caption=caption,
        width=stored.width,
        height=stored.height,
        created_at=clock.now(),
    )
    db.add(photo)
    db.commit()
    log.info("photo_uploaded", battle_id=battle.id, photo_id=photo.id)
    return views.photo_view(photo, show_caption=True)


@router.delete("/battles/{battle_id}/photos/{photo_id}")
def delete_photo(
    battle_id: int, photo_id: int, db: DbSession, settings: SettingsDep
) -> dict[str, bool]:
    battle = _admin_battle(db, battle_id)
    if battle.status != BattleStatus.DRAFT:
        raise _not_draft()
    photo = db.get(Photo, photo_id)
    if photo is None or photo.battle_id != battle.id:
        raise not_found()
    file_path = settings.media_dir / f"{photo.file_key}.jpg"
    db.delete(photo)
    db.commit()
    file_path.unlink(missing_ok=True)
    log.info("photo_deleted", battle_id=battle.id, photo_id=photo_id)
    return {"ok": True}


@router.post("/battles/{battle_id}/start")
def start_battle(battle_id: int, request: Request, db: DbSession) -> dict[str, Any]:
    battle = _admin_battle(db, battle_id)
    with game.LOCK:
        db.refresh(battle)
        if battle.status != BattleStatus.DRAFT:
            raise _not_draft()
        count = db.scalar(select(func.count(Photo.id)).where(Photo.battle_id == battle.id))
        if count is None or count < MIN_PHOTOS:
            raise ApiError(409, "not_enough_photos", "Для старта нужно хотя бы 2 фото.")
        game.start_battle(db, battle, clock.now())
        db.commit()
    log.info("battle_started", battle_id=battle.id)
    return _admin_view(request, db, battle)


@router.post("/battles/{battle_id}/finish-round")
def finish_round(battle_id: int, request: Request, db: DbSession) -> dict[str, Any]:
    battle = _admin_battle(db, battle_id)
    with game.LOCK:
        db.refresh(battle)
        if battle.status != BattleStatus.ACTIVE or battle.round_state != RoundState.RUNNING:
            raise ApiError(409, "round_not_running", "Сейчас нет идущего раунда.")
        game.close_round(db, battle, clock.now())
        db.commit()
    return _admin_view(request, db, battle)


@router.post("/battles/{battle_id}/next-round")
def next_round(battle_id: int, request: Request, db: DbSession) -> dict[str, Any]:
    battle = _admin_battle(db, battle_id)
    with game.LOCK:
        db.refresh(battle)
        if (
            battle.status != BattleStatus.ACTIVE
            or battle.round_state != RoundState.BREAK
            or battle.current_round is None
        ):
            raise ApiError(409, "round_not_finished", "Текущий раунд ещё не закончен.")
        game.start_round(db, battle, battle.current_round + 1, clock.now())
        db.commit()
    return _admin_view(request, db, battle)


def _not_active() -> ApiError:
    return ApiError(409, "not_active", "Батл сейчас не идёт.")


@router.post("/battles/{battle_id}/stop")
def stop_battle(battle_id: int, request: Request, db: DbSession) -> dict[str, Any]:
    battle = _admin_battle(db, battle_id)
    with game.LOCK:
        db.refresh(battle)
        if battle.status != BattleStatus.ACTIVE:
            raise _not_active()
        battle.status = BattleStatus.STOPPED
        battle.round_state = None
        battle.round_ends_at = None
        db.commit()
    log.info("battle_stopped", battle_id=battle.id)
    return _admin_view(request, db, battle)


@router.post("/battles/{battle_id}/photos/{photo_id}/remove")
def remove_photo(battle_id: int, photo_id: int, request: Request, db: DbSession) -> dict[str, Any]:
    battle = _admin_battle(db, battle_id)
    photo = db.get(Photo, photo_id)
    if photo is None or photo.battle_id != battle.id:
        raise not_found()
    with game.LOCK:
        db.refresh(battle)
        if battle.status != BattleStatus.ACTIVE:
            raise _not_active()
        match = db.scalar(
            select(Match).where(
                Match.battle_id == battle.id,
                Match.round == battle.current_round,
                Match.status == MatchStatus.ACTIVE,
                or_(Match.photo_a_id == photo.id, Match.photo_b_id == photo.id),
            )
        )
        if match is None:
            raise ApiError(
                409, "not_in_active_match", "Это фото сейчас не участвует в идущей дуэли."
            )
        match.winner_id = match.photo_b_id if match.photo_a_id == photo.id else match.photo_a_id
        match.decided_by = DecidedBy.REMOVAL
        match.status = MatchStatus.FINISHED
        db.commit()
    log.info("photo_removed", battle_id=battle.id, photo_id=photo.id, match_id=match.id)
    return _admin_view(request, db, battle)


def _join_link(request: Request, db: Session, battle: Battle) -> tuple[str, datetime]:
    if battle.status != BattleStatus.ACTIVE:
        raise _not_active()
    state = request.app.state
    now = clock.now()
    # Открытый код нужен ведущему для QR, а в БД лежит только хеш, поэтому
    # текущий код живёт в памяти процесса.
    with state.join_lock:
        current = state.join_codes.get(battle.id)
        if current is None or now - current[1] >= JOIN_CODE_ROTATE:
            code = secrets.token_urlsafe(6)
            valid_until = now + JOIN_CODE_TTL
            db.execute(
                delete(JoinCode).where(JoinCode.battle_id == battle.id, JoinCode.valid_until <= now)
            )
            db.add(
                JoinCode(
                    battle_id=battle.id,
                    code_hash=digest(state.settings, code),
                    valid_until=valid_until,
                )
            )
            db.commit()
            current = (code, now, valid_until)
            state.join_codes[battle.id] = current
            log.info("join_code_issued", battle_id=battle.id)
    return f"{state.settings.public_base_url}/join/{battle.id}?code={current[0]}", current[2]


@router.get("/battles/{battle_id}/join")
def get_join_link(battle_id: int, request: Request, db: DbSession) -> dict[str, Any]:
    url, valid_until = _join_link(request, db, _admin_battle(db, battle_id))
    return {"url": url, "valid_until": views.iso(valid_until)}


@router.get("/battles/{battle_id}/qr.svg")
def get_join_qr(battle_id: int, request: Request, db: DbSession) -> Response:
    url, _ = _join_link(request, db, _admin_battle(db, battle_id))
    buffer = BytesIO()
    segno.make(url, error="m", micro=False).save(buffer, kind="svg", scale=10, border=2)
    return Response(
        content=buffer.getvalue(),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store"},
    )
