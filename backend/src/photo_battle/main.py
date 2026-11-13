import asyncio
import contextlib
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, sessionmaker
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.types import Scope

from photo_battle import api_admin, api_public, game
from photo_battle.config import Settings, load_settings
from photo_battle.db import make_engine
from photo_battle.errors import install_error_handlers
from photo_battle.logs import configure_logging
from photo_battle.middleware import RequestIdMiddleware, UploadLimitMiddleware

log = structlog.get_logger()

TICK_SECONDS = 1


class SpaStaticFiles(StaticFiles):
    """Собранный фронт: неизвестные пути вне /api и /media получают index.html."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            request_path = scope["path"] + "/"
            if exc.status_code != 404 or request_path.startswith(("/api/", "/media/")):
                raise
            return await super().get_response("index.html", scope)


async def _close_rounds_forever(session_factory: sessionmaker[Session]) -> None:
    while True:
        try:
            await asyncio.to_thread(game.close_all_due, session_factory)
        except Exception as exc:
            log.error("round_tick_failed", exc_type=type(exc).__name__)
        await asyncio.sleep(TICK_SECONDS)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    configure_logging()
    engine = make_engine(settings.database_url)
    session_factory = sessionmaker(engine)
    settings.media_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        task = asyncio.create_task(_close_rounds_forever(session_factory))
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            engine.dispose()

    app = FastAPI(title="Фото-батлы", lifespan=lifespan)
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.login_lock = threading.Lock()
    app.state.login_failures = {}
    app.state.join_lock = threading.Lock()
    app.state.join_codes = {}

    install_error_handlers(app)
    app.add_middleware(UploadLimitMiddleware)
    app.add_middleware(RequestIdMiddleware)

    app.include_router(api_public.router)
    app.include_router(api_admin.auth_router)
    app.include_router(api_admin.router)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    if settings.frontend_dist is not None:
        app.mount("/", SpaStaticFiles(directory=settings.frontend_dist), name="frontend")
    return app


def __getattr__(name: str) -> FastAPI:
    # Приложение создаётся при первом обращении к main.app, чтобы импорт модуля
    # в тестах не требовал переменных окружения.
    if name == "app":
        return create_app()
    raise AttributeError(name)
