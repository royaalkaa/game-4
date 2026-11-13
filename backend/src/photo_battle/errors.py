import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger()

# Ответы на ошибки уровня HTTP, которые возникают до кода приложения.
HTTP_ERRORS: dict[int, tuple[str, str]] = {
    400: ("bad_request", "Некорректный запрос."),
    401: ("unauthorized", "Нет доступа."),
    404: ("not_found", "Не найдено."),
    405: ("method_not_allowed", "Этот метод здесь не поддерживается."),
    413: ("too_large", "Файл больше 10 МБ."),
}


class ApiError(Exception):
    """Ошибка с текстом для человека: уходит клиенту как есть."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(code)
        self.status_code = status_code
        self.code = code
        self.message = message


def not_found() -> ApiError:
    return ApiError(404, "not_found", "Не найдено.")


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, content={"error": {"code": code, "message": message}}
    )


async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message)


async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = HTTP_ERRORS.get(exc.status_code, ("http_error", "Запрос не выполнен."))
    return error_response(exc.status_code, code, message)


async def _validation_error(request: Request, exc: Exception) -> JSONResponse:
    return error_response(422, "validation", "Проверьте введённые данные.")


async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled_error", exc_type=type(exc).__name__, path=request.url.path)
    return error_response(500, "internal", "Что-то пошло не так. Попробуйте ещё раз.")


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(Exception, _unhandled)
