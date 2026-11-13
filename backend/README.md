# Фото-батлы: бэкенд

FastAPI, SQLAlchemy 2, Alembic. Правила игры в `../docs/SPEC.md`, контракт в `../docs/API.md`.
Все команды запускаются из папки `backend`.

## Хеш пароля админа

ПК:

```powershell
uv run python -m photo_battle.tools.hash_password
```

Команда дважды спрашивает пароль без эха и печатает строку `scrypt:...` для `ADMIN_PASSWORD_HASH`.

## Переменные окружения

Список имён лежит в `.env.example`. Значения задаются в окружении или в файле `.env`.

| Переменная | Обязательна | По умолчанию |
| --- | --- | --- |
| `SECRET_KEY` | да | |
| `ADMIN_PASSWORD_HASH` | да | |
| `PUBLIC_BASE_URL` | да, адрес фронта для ссылки в QR | |
| `DATABASE_URL` | нет | `sqlite:///data/photo_battle.db` |
| `MEDIA_DIR` | нет | `data/media` |
| `COOKIE_SECURE` | нет | `true` (для локального HTTP поставить `false`) |
| `FRONTEND_DIST` | нет | собранный фронт не отдаётся |

Без обязательных переменных приложение не стартует и называет недостающие.

## Миграции

ПК:

```powershell
uv run alembic upgrade head
```

## Запуск

ПК:

```powershell
uv run uvicorn photo_battle.main:app --port 8000
```

## Гейты

ПК:

```powershell
uv run ruff check
uv run ruff format --check
uv run pytest --cov=src --cov-fail-under=60
```

Если политика Windows блокирует exe-обёртки из `.venv` (`Failed to spawn`), те же команды
работают через модуль: `uv run python -m alembic ...`, `uv run python -m uvicorn ...`,
`uv run python -m pytest ...`.
