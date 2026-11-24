from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import DateTime, Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator[datetime]):
    """Хранит время в UTC и всегда возвращает его с часовым поясом, в том числе из SQLite."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


SQLITE_POOL_SIZE = 40


def _sqlite_pragmas(dbapi_connection: Any, connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    # WAL: чтения не ждут запись, а запись не ждёт чтения; без него каждый голос
    # блокирует опрос батла у всех гостей.
    cursor.execute("PRAGMA journal_mode=WAL")
    # В режиме WAL это безопасно при падении процесса; без него каждая запись ждёт диск.
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


def make_engine(url: str) -> Engine:
    parsed = make_url(url)
    if parsed.get_backend_name() != "sqlite":
        return create_engine(url, pool_pre_ping=True)
    if parsed.database and parsed.database != ":memory:":
        Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
    # Запросы идут из пула потоков FastAPI и из фоновой задачи.
    # Пул без потолка: сессия из Depends отдаёт соединение только в teardown, а teardown
    # идёт в том же пуле из 40 потоков. С потолком под залом из 100+ гостей все потоки
    # ждали соединение, а соединения ждали свободный поток для teardown: взаимная
    # блокировка до таймаута 30 с. Число одновременных запросов и так держит пул потоков.
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False},
        pool_size=SQLITE_POOL_SIZE,
        max_overflow=-1,
    )
    event.listen(engine, "connect", _sqlite_pragmas)
    return engine
