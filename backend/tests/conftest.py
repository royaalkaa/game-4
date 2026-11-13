from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from helpers import ADMIN_HASH, ADMIN_SECRET, FakeClock

from photo_battle import clock
from photo_battle.config import Settings
from photo_battle.db import Base, make_engine
from photo_battle.main import create_app


@pytest.fixture
def fake_clock(monkeypatch: pytest.MonkeyPatch) -> FakeClock:
    fake = FakeClock()
    monkeypatch.setattr(clock, "now", fake)
    return fake


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        secret_key="test-secret-key",
        admin_password_hash=ADMIN_HASH,
        public_base_url="http://hall.test/",
        database_url="sqlite:///" + (tmp_path / "test.db").as_posix(),
        media_dir=tmp_path / "media",
        cookie_secure=False,
    )


@pytest.fixture
def app(settings: Settings, fake_clock: FakeClock) -> FastAPI:
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)
    engine.dispose()
    return create_app(settings)


@pytest.fixture
def admin(app: FastAPI) -> Iterator[TestClient]:
    # Без with: lifespan с фоновой задачей не стартует, время двигает только FakeClock.
    client = TestClient(app)
    response = client.post("/api/admin/login", json={"password": ADMIN_SECRET})
    assert response.status_code == 200
    yield client
    client.close()


@pytest.fixture
def guest(app: FastAPI) -> Iterator[TestClient]:
    client = TestClient(app)
    yield client
    client.close()
