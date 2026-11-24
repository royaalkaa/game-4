import re
import time
from uuid import uuid4

import structlog
from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from photo_battle.errors import HTTP_ERRORS, error_response
from photo_battle.images import MAX_UPLOAD_BYTES

log = structlog.get_logger()

REQUEST_ID_RE = re.compile(r"[A-Za-z0-9._-]{1,64}")
UPLOAD_PATH_RE = re.compile(r"/api(/admin)?/battles/\d{1,18}/(photos|my-photo)")
# Запас на заголовки multipart и подпись поверх лимита самого файла.
UPLOAD_BODY_LIMIT = MAX_UPLOAD_BYTES + 64 * 1024


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = Headers(scope=scope).get("x-request-id", "")
        request_id = incoming if REQUEST_ID_RE.fullmatch(incoming) else uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        started = time.perf_counter()
        status = 500

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            log.info(
                "http_request",
                method=scope["method"],
                path=scope["path"],
                status=status,
                duration_ms=round((time.perf_counter() - started) * 1000, 1),
            )


class UploadLimitMiddleware:
    """Обрывает загрузку фото, как только тело запроса превышает лимит.

    FastAPI разбирает multipart целиком до вызова обработчика, поэтому отсечка
    по размеру нужна на уровне потока, а не в самом обработчике.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or UPLOAD_PATH_RE.fullmatch(scope["path"]) is None
        ):
            await self.app(scope, receive, send)
            return
        declared = Headers(scope=scope).get("content-length", "")
        if declared.isdigit() and int(declared) > UPLOAD_BODY_LIMIT:
            code, message = HTTP_ERRORS[413]
            await error_response(413, code, message)(scope, receive, send)
            return
        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > UPLOAD_BODY_LIMIT:
                    raise HTTPException(status_code=413)
            return message

        await self.app(scope, limited_receive, send)
