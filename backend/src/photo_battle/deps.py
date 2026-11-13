from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from photo_battle import clock
from photo_battle.config import Settings
from photo_battle.errors import ApiError
from photo_battle.models import AdminSession, Voter
from photo_battle.security import token_digest

ADMIN_COOKIE = "pb_admin"


def voter_cookie(battle_id: int) -> str:
    return f"pb_v_{battle_id}"


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as db:
        yield db


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


DbSession = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def digest(settings: Settings, token: str) -> str:
    return token_digest(settings.secret_key.get_secret_value(), token)


def set_cookie(response: Response, settings: Settings, name: str, token: str, max_age: int) -> None:
    response.set_cookie(
        name,
        token,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )


def require_admin(request: Request, db: DbSession, settings: SettingsDep) -> AdminSession:
    token = request.cookies.get(ADMIN_COOKIE)
    if token:
        session = db.scalar(
            select(AdminSession).where(
                AdminSession.token_hash == digest(settings, token),
                AdminSession.expires_at > clock.now(),
            )
        )
        if session is not None:
            return session
    raise ApiError(401, "admin_required", "Войдите как администратор.")


AdminDep = Annotated[AdminSession, Depends(require_admin)]


def find_voter(request: Request, db: Session, settings: Settings, battle_id: int) -> Voter | None:
    token = request.cookies.get(voter_cookie(battle_id))
    if not token:
        return None
    return db.scalar(
        select(Voter).where(
            Voter.battle_id == battle_id, Voter.token_hash == digest(settings, token)
        )
    )
