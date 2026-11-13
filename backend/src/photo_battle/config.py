import re
from pathlib import Path

from pydantic import SecretStr, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Формат: scrypt:<n>:<r>:<p>:<соль hex>:<хеш hex>, его пишет photo_battle.tools.hash_password.
ADMIN_HASH_RE = re.compile(r"scrypt:\d{1,8}:\d{1,3}:\d{1,3}:[0-9a-f]{32,128}:[0-9a-f]{32,128}")


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    database_url: str = "sqlite:///" + (Path("data") / "photo_battle.db").as_posix()


class Settings(DatabaseSettings):
    secret_key: SecretStr
    admin_password_hash: SecretStr
    public_base_url: str
    media_dir: Path = Path("data") / "media"
    cookie_secure: bool = True
    frontend_dist: Path | None = None

    @field_validator("secret_key")
    @classmethod
    def _secret_not_blank(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().strip():
            raise ValueError("empty")
        return value

    @field_validator("admin_password_hash")
    @classmethod
    def _hash_format(cls, value: SecretStr) -> SecretStr:
        if ADMIN_HASH_RE.fullmatch(value.get_secret_value()) is None:
            raise ValueError("format")
        return value

    @field_validator("public_base_url")
    @classmethod
    def _base_url(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("scheme")
        return value.rstrip("/")


def load_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        # Текст ValidationError содержит введённые значения, поэтому наружу идут только имена.
        names = sorted({str(err["loc"][0]).upper() for err in exc.errors() if err["loc"]})
        raise RuntimeError(
            "Не заданы или заданы неверно переменные окружения: " + ", ".join(names)
        ) from None
