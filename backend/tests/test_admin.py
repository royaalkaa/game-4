import threading

import pytest
from fastapi.testclient import TestClient
from helpers import ADMIN_HASH, ADMIN_SECRET, create_battle

from photo_battle import views
from photo_battle.config import Settings, load_settings
from photo_battle.main import create_app
from photo_battle.security import verify_admin_password


def error_code(response) -> str:
    return response.json()["error"]["code"]


def test_login_throttled_after_five_failures(guest) -> None:
    for _ in range(5):
        response = guest.post("/api/admin/login", json={"password": "wrong"})
        assert response.status_code == 401
        assert error_code(response) == "bad_password"

    response = guest.post("/api/admin/login", json={"password": ADMIN_SECRET})
    assert response.status_code == 429
    assert error_code(response) == "too_many_attempts"


def test_parallel_logins_do_not_bypass_limit(guest) -> None:
    barrier = threading.Barrier(10)
    codes: list[int] = []

    def attempt() -> None:
        barrier.wait()
        codes.append(guest.post("/api/admin/login", json={"password": "wrong"}).status_code)

    threads = [threading.Thread(target=attempt) for _ in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert codes.count(401) == 5
    assert codes.count(429) == 5


def test_successful_login_is_not_counted_as_failure(guest) -> None:
    for _ in range(4):
        guest.post("/api/admin/login", json={"password": "wrong"})
    assert guest.post("/api/admin/login", json={"password": ADMIN_SECRET}).status_code == 200
    assert guest.post("/api/admin/login", json={"password": "wrong"}).status_code == 401


def test_failures_expire_after_ten_minutes(guest, fake_clock) -> None:
    for _ in range(5):
        guest.post("/api/admin/login", json={"password": "wrong"})
    fake_clock.advance(600)
    assert guest.post("/api/admin/login", json={"password": ADMIN_SECRET}).status_code == 200


def test_admin_session_cookie_and_logout(guest) -> None:
    response = guest.get("/api/admin/me")
    assert response.status_code == 401
    assert error_code(response) == "admin_required"

    login = guest.post("/api/admin/login", json={"password": ADMIN_SECRET})
    cookie = login.headers["set-cookie"]
    assert cookie.startswith("pb_admin=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert guest.get("/api/admin/me").json() == {"admin": True}

    token = guest.cookies.get("pb_admin")
    assert guest.post("/api/admin/logout").json() == {"ok": True}
    stale = guest.get("/api/admin/me", headers={"Cookie": f"pb_admin={token}"})
    assert stale.status_code == 401


def test_secure_cookie_when_enabled(app, settings) -> None:
    secure = settings.model_copy(update={"cookie_secure": True})
    client = TestClient(create_app(secure))
    login = client.post("/api/admin/login", json={"password": ADMIN_SECRET})
    assert "Secure" in login.headers["set-cookie"]


def test_battle_list_and_validation(admin) -> None:
    first = create_battle(admin, 2)
    second = create_battle(admin, 0, title="Второй")
    listed = admin.get("/api/admin/battles").json()
    assert [b["id"] for b in listed] == [second, first]
    assert listed[1]["photo_count"] == 2
    assert listed[0]["status"] == "draft"

    bad = {"title": "", "theme": "", "round_seconds": 60, "freeze_seconds": 0}
    response = admin.post("/api/admin/battles", json={**bad, "auto_advance": False})
    assert response.status_code == 422
    assert error_code(response) == "validation"

    frozen_too_long = {
        "title": "Батл",
        "theme": "",
        "round_seconds": 60,
        "freeze_seconds": 60,
        "auto_advance": False,
    }
    assert admin.post("/api/admin/battles", json=frozen_too_long).status_code == 422


def test_draft_battle_hidden_and_errors_in_contract_format(admin, guest) -> None:
    draft = create_battle(admin, 2)
    for path in (f"/api/battles/{draft}", "/api/battles/999", "/api/unknown"):
        response = guest.get(path)
        assert response.status_code == 404
        assert error_code(response) == "not_found"
        assert response.json()["error"]["message"]
    assert admin.get(f"/api/admin/battles/{draft}").json()["status"] == "draft"


def test_request_id_header(guest) -> None:
    response = guest.get("/api/battles/1", headers={"X-Request-ID": "abc-123"})
    assert response.headers["x-request-id"] == "abc-123"
    generated = guest.get("/api/battles/1", headers={"X-Request-ID": "bad id!"})
    assert len(generated.headers["x-request-id"]) == 32


def test_unexpected_error_returns_neutral_500(app, admin, monkeypatch) -> None:
    battle = create_battle(admin, 2)
    admin.post(f"/api/admin/battles/{battle}/start")

    def boom(*args, **kwargs):
        raise RuntimeError("секретная деталь")

    monkeypatch.setattr(views, "battle_view", boom)
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(f"/api/battles/{battle}")
    assert response.status_code == 500
    assert error_code(response) == "internal"
    assert "секретная" not in response.text


def test_settings_require_secrets(monkeypatch, tmp_path) -> None:
    for name in ("SECRET_KEY", "ADMIN_PASSWORD_HASH", "PUBLIC_BASE_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("SECRET_KEY", "visible-value-must-not-leak")
    monkeypatch.chdir(tmp_path)
    with pytest.raises(RuntimeError) as error:
        load_settings()
    assert "ADMIN_PASSWORD_HASH" in str(error.value)
    assert "PUBLIC_BASE_URL" in str(error.value)
    assert "visible-value" not in str(error.value)


def test_settings_reject_malformed_hash() -> None:
    with pytest.raises(ValueError):
        Settings(
            _env_file=None,
            secret_key="k",
            admin_password_hash="plain",
            public_base_url="https://x.test",
        )


def test_password_hash_roundtrip() -> None:
    assert verify_admin_password(ADMIN_SECRET, ADMIN_HASH)
    assert not verify_admin_password("other", ADMIN_HASH)


def test_frontend_dist_fallback(app, settings, tmp_path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>spa</html>", encoding="utf-8")
    (dist / "app.js").write_text("console.log(1)", encoding="utf-8")
    client = TestClient(create_app(settings.model_copy(update={"frontend_dist": dist})))

    assert client.get("/join/1").text == "<html>spa</html>"
    assert client.get("/app.js").text == "console.log(1)"
    assert error_code(client.get("/api/nothing")) == "not_found"
    assert error_code(client.get("/media/none.jpg")) == "not_found"
