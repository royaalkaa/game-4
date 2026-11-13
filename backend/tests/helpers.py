from datetime import UTC, datetime, timedelta
from io import BytesIO

from fastapi.testclient import TestClient
from httpx import Response
from PIL import Image

from photo_battle.security import hash_admin_password

ADMIN_SECRET = "correct horse battery"
ADMIN_HASH = hash_admin_password(ADMIN_SECRET)
START = datetime(2026, 11, 13, 18, 0, tzinfo=UTC)


class FakeClock:
    def __init__(self) -> None:
        self.current = START

    def __call__(self) -> datetime:
        return self.current

    def advance(self, seconds: float) -> None:
        self.current += timedelta(seconds=seconds)


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value)


def image_bytes(fmt: str = "JPEG", size: tuple[int, int] = (64, 48), **save_args) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buffer, fmt, **save_args)
    return buffer.getvalue()


def upload(
    client: TestClient, battle_id: int, data: bytes, name: str = "photo.jpg", **form: str
) -> Response:
    return client.post(
        f"/api/admin/battles/{battle_id}/photos",
        files={"file": (name, data, "image/jpeg")},
        data=form,
    )


def create_battle(client: TestClient, photos: int = 0, **overrides) -> int:
    body = {
        "title": "Осенний батл",
        "theme": "Осень",
        "round_seconds": 60,
        "freeze_seconds": 0,
        "auto_advance": False,
        **overrides,
    }
    response = client.post("/api/admin/battles", json=body)
    assert response.status_code == 200, response.text
    battle_id = response.json()["id"]
    for index in range(photos):
        response = upload(client, battle_id, image_bytes(), caption=f"Автор {index}")
        assert response.status_code == 200, response.text
    return battle_id


def start_battle(client: TestClient, photos: int, **overrides) -> int:
    battle_id = create_battle(client, photos, **overrides)
    response = client.post(f"/api/admin/battles/{battle_id}/start")
    assert response.status_code == 200, response.text
    return battle_id


def join_code(admin_client: TestClient, battle_id: int) -> str:
    response = admin_client.get(f"/api/admin/battles/{battle_id}/join")
    assert response.status_code == 200, response.text
    return response.json()["url"].split("code=", 1)[1]


class Guest:
    """Зритель со своим токеном: запросы идут через общий клиент с явной cookie."""

    def __init__(self, client: TestClient, battle_id: int, token: str) -> None:
        self.client = client
        self.cookie = f"pb_v_{battle_id}={token}"

    def get(self, path: str) -> Response:
        return self.client.get(path, headers={"Cookie": self.cookie})

    def vote(self, match_id: int, photo_id: int) -> Response:
        return self.client.post(
            f"/api/matches/{match_id}/vote",
            json={"photo_id": photo_id},
            headers={"Cookie": self.cookie},
        )


def try_join(guest_client: TestClient, battle_id: int, code: str) -> tuple[Response, Guest | None]:
    guest_client.cookies.clear()
    response = guest_client.post(f"/api/battles/{battle_id}/join", json={"code": code})
    token = guest_client.cookies.get(f"pb_v_{battle_id}")
    guest_client.cookies.clear()
    if response.status_code != 200 or token is None:
        return response, None
    return response, Guest(guest_client, battle_id, token)


def join(guest_client: TestClient, admin_client: TestClient, battle_id: int) -> Guest:
    response, voter = try_join(guest_client, battle_id, join_code(admin_client, battle_id))
    assert voter is not None, response.text
    return voter


def active_matches(client: TestClient, battle_id: int) -> list[dict]:
    rounds = client.get(f"/api/admin/battles/{battle_id}").json()["bracket"]["rounds"]
    return [m for r in rounds for m in r["matches"] if m["status"] == "active"]
