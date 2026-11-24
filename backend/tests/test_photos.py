from io import BytesIO

import pytest
from helpers import create_battle, image_bytes, start_battle, upload
from PIL import Image

from photo_battle.images import MAX_UPLOAD_BYTES

GPS_IFD = 0x8825
ORIENTATION = 0x0112


def error_code(response) -> str:
    return response.json()["error"]["code"]


@pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP"])
def test_allowed_formats_are_reencoded_to_jpeg(admin, settings, fmt: str) -> None:
    battle_id = create_battle(admin)
    response = upload(admin, battle_id, image_bytes(fmt), name="picture.bin")
    assert response.status_code == 200, response.text
    photo = response.json()
    key = photo["url"].removeprefix("/media/").removesuffix(".jpg")
    assert len(key) == 32
    with Image.open(settings.media_dir / f"{key}.jpg") as stored:
        assert stored.format == "JPEG"


def test_spoofed_extension_is_rejected(admin) -> None:
    battle_id = create_battle(admin)
    gif = image_bytes("GIF")
    response = upload(admin, battle_id, gif, name="photo.jpg")
    assert response.status_code == 400
    assert error_code(response) == "bad_image"

    response = upload(admin, battle_id, b"not an image at all", name="photo.png")
    assert response.status_code == 400
    assert error_code(response) == "bad_image"


def test_file_over_10_mb_is_rejected(admin) -> None:
    battle_id = create_battle(admin)
    data = image_bytes() + b"\0" * MAX_UPLOAD_BYTES
    response = upload(admin, battle_id, data[: MAX_UPLOAD_BYTES + 1])
    assert response.status_code == 413
    assert error_code(response) == "too_large"


def test_body_far_over_limit_is_cut_by_middleware(admin) -> None:
    battle_id = create_battle(admin)
    response = upload(admin, battle_id, b"\0" * (MAX_UPLOAD_BYTES + 512 * 1024))
    assert response.status_code == 413
    assert error_code(response) == "too_large"


def test_side_over_8000_px_is_rejected(admin) -> None:
    battle_id = create_battle(admin)
    response = upload(admin, battle_id, image_bytes("PNG", size=(8001, 2)))
    assert response.status_code == 400
    assert error_code(response) == "bad_image"


def test_exif_and_gps_are_stripped_and_orientation_applied(admin, guest, settings) -> None:
    exif = Image.Exif()
    exif[ORIENTATION] = 6
    exif[0x010F] = "TestCam"
    exif[GPS_IFD] = {1: "N", 2: (55.0, 45.0, 0.0), 3: "E", 4: (37.0, 37.0, 0.0)}
    source = image_bytes("JPEG", size=(64, 48), exif=exif)
    with Image.open(BytesIO(source)) as check:
        assert check.getexif().get_ifd(GPS_IFD), "исходное фото должно содержать GPS"

    battle_id = create_battle(admin)
    photo = upload(admin, battle_id, source).json()
    assert (photo["width"], photo["height"]) == (48, 64)

    served = guest.get(photo["url"])
    assert served.status_code == 200
    with Image.open(BytesIO(served.content)) as stored:
        assert "exif" not in stored.info
        assert len(stored.getexif()) == 0
        assert not stored.getexif().get_ifd(GPS_IFD)
        assert "icc_profile" not in stored.info


def test_large_photo_is_downscaled(admin) -> None:
    battle_id = create_battle(admin)
    photo = upload(admin, battle_id, image_bytes("PNG", size=(4096, 1024))).json()
    assert (photo["width"], photo["height"]) == (2048, 512)


def test_photo_limits_and_draft_only(admin, settings) -> None:
    battle_id = create_battle(admin, 16)
    response = upload(admin, battle_id, image_bytes())
    assert response.status_code == 409
    assert error_code(response) == "too_many_photos"

    photos = admin.get(f"/api/admin/battles/{battle_id}").json()["photos"]
    key = photos[0]["url"].removeprefix("/media/")
    assert admin.delete(f"/api/admin/battles/{battle_id}/photos/{photos[0]['id']}").json() == {
        "ok": True
    }
    assert not (settings.media_dir / key).exists()

    started = start_battle(admin, 2)
    response = upload(admin, started, image_bytes())
    assert response.status_code == 409
    assert error_code(response) == "not_draft"


def test_caption_hidden_from_guests_until_match_finished(admin, guest) -> None:
    battle_id = start_battle(admin, 2)
    rounds = guest.get(f"/api/battles/{battle_id}/bracket").json()["rounds"]
    assert rounds[0]["matches"][0]["photo_a"]["caption"] is None

    admin_match = admin.get(f"/api/admin/battles/{battle_id}").json()["bracket"]["rounds"][0]
    assert admin_match["matches"][0]["photo_a"]["caption"].startswith("Автор")

    admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1})
    rounds = guest.get(f"/api/battles/{battle_id}/bracket").json()["rounds"]
    assert rounds[0]["matches"][0]["photo_a"]["caption"].startswith("Автор")


def put_background(client, battle_id: int, data: bytes):
    return client.put(
        f"/api/admin/battles/{battle_id}/background",
        files={"file": ("bg.png", data, "image/png")},
    )


def test_background_set_replace_and_clear(admin, guest, settings) -> None:
    battle_id = start_battle(admin, 2)
    assert guest.get(f"/api/battles/{battle_id}").json()["background_url"] is None

    first = put_background(admin, battle_id, image_bytes("PNG", (3000, 1500)))
    assert first.status_code == 200, first.text
    first_url = first.json()["background_url"]
    first_file = settings.media_dir / first_url.removeprefix("/media/")
    assert first_file.is_file()
    with Image.open(first_file) as stored:
        assert stored.format == "JPEG"
        assert max(stored.size) <= 2048
    assert guest.get(f"/api/battles/{battle_id}").json()["background_url"] == first_url

    second = put_background(admin, battle_id, image_bytes("JPEG"))
    second_url = second.json()["background_url"]
    assert second_url != first_url
    assert not first_file.exists()

    cleared = admin.delete(f"/api/admin/battles/{battle_id}/background")
    assert cleared.status_code == 200
    assert cleared.json()["background_url"] is None
    assert not (settings.media_dir / second_url.removeprefix("/media/")).exists()


def test_background_needs_admin_and_a_real_image(admin, guest) -> None:
    battle_id = create_battle(admin)
    assert put_background(guest, battle_id, image_bytes()).status_code == 401
    bad = put_background(admin, battle_id, b"not an image")
    assert bad.status_code == 400
    assert error_code(bad) == "bad_image"
    assert admin.get(f"/api/admin/battles/{battle_id}").json()["background_url"] is None
