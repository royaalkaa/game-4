from fastapi.testclient import TestClient
from helpers import Guest, create_battle, error_code_of, image_bytes, join, upload


def swipe_battle(admin: TestClient, **overrides) -> int:
    battle_id = create_battle(admin, mode="swipe", round_seconds=120, **overrides)
    response = admin.post(f"/api/admin/battles/{battle_id}/start")
    assert response.status_code == 200, response.text
    assert response.json()["phase"] == "collecting"
    return battle_id


def send_photo(guest: Guest, battle_id: int, name: str = "Анна Иванова"):
    return guest.client.post(
        f"/api/battles/{battle_id}/my-photo",
        files={"file": ("me.jpg", image_bytes(), "image/jpeg")},
        data={"name": name},
        headers={"Cookie": guest.cookie},
    )


def deck(guest: Guest, battle_id: int) -> dict:
    response = guest.get(f"/api/battles/{battle_id}/deck")
    assert response.status_code == 200, response.text
    return response.json()


def swipe(guest: Guest, photo_id: int, liked: bool):
    return guest.client.post(
        f"/api/photos/{photo_id}/swipe", json={"liked": liked}, headers={"Cookie": guest.cookie}
    )


def start_voting(admin: TestClient, battle_id: int):
    return admin.post(f"/api/admin/battles/{battle_id}/start-voting")


def test_duel_is_default_mode(admin: TestClient) -> None:
    battle_id = create_battle(admin)
    assert admin.get(f"/api/admin/battles/{battle_id}").json()["mode"] == "duel"


def test_swipe_battle_opens_collecting_without_photos(admin: TestClient) -> None:
    battle_id = swipe_battle(admin)
    battle = admin.get(f"/api/admin/battles/{battle_id}").json()
    assert battle["status"] == "active"
    assert battle["participants"] == 0


def test_guest_uploads_photo_with_name_and_replaces_it(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna = join(guest, admin, battle_id)

    first = send_photo(anna, battle_id)
    assert first.status_code == 200, first.text
    assert first.json()["caption"] == "Анна Иванова"
    second = send_photo(anna, battle_id, name="Аня")
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    me = anna.get(f"/api/battles/{battle_id}").json()
    assert me["my_photo"]["caption"] == "Аня"
    assert me["participants"] == 1


def test_guest_photo_needs_name_and_join(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna = join(guest, admin, battle_id)
    assert error_code_of(send_photo(anna, battle_id, name="   ")) == "validation"
    stranger = Guest(guest, battle_id, "not-a-token")
    assert error_code_of(send_photo(stranger, battle_id)) == "not_joined"


def test_guest_can_delete_own_photo_while_collecting(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna = join(guest, admin, battle_id)
    send_photo(anna, battle_id)
    response = guest.delete(f"/api/battles/{battle_id}/my-photo", headers={"Cookie": anna.cookie})
    assert response.json() == {"ok": True}
    assert anna.get(f"/api/battles/{battle_id}").json()["my_photo"] is None


def test_voting_needs_two_photos(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    send_photo(join(guest, admin, battle_id), battle_id)
    assert error_code_of(start_voting(admin, battle_id)) == "not_enough_photos"


def test_deck_skips_own_photo_and_self_swipe_is_refused(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna, boris, vera = (join(guest, admin, battle_id) for _ in range(3))
    own = send_photo(anna, battle_id, "Анна").json()["id"]
    send_photo(boris, battle_id, "Борис")
    send_photo(vera, battle_id, "Вера")
    assert start_voting(admin, battle_id).json()["phase"] == "voting"

    cards = deck(anna, battle_id)
    assert cards["total"] == 2
    assert own not in [photo["id"] for photo in cards["photos"]]
    assert {photo["caption"] for photo in cards["photos"]} == {"Борис", "Вера"}
    assert error_code_of(swipe(anna, own, True)) == "own_photo"


def test_upload_is_closed_after_voting_starts(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna, boris, late = (join(guest, admin, battle_id) for _ in range(3))
    send_photo(anna, battle_id)
    send_photo(boris, battle_id)
    start_voting(admin, battle_id)
    assert error_code_of(send_photo(late, battle_id)) == "collecting_closed"


def test_swipe_once_per_photo_and_deck_shrinks(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna, boris = join(guest, admin, battle_id), join(guest, admin, battle_id)
    upload(admin, battle_id, image_bytes(), caption="Фото ведущего")
    send_photo(anna, battle_id)
    start_voting(admin, battle_id)

    first = deck(boris, battle_id)["photos"][0]["id"]
    assert swipe(boris, first, True).json() == {"ok": True}
    assert error_code_of(swipe(boris, first, False)) == "already_swiped"
    left = deck(boris, battle_id)
    assert left["total"] == 2
    assert first not in [photo["id"] for photo in left["photos"]]


def test_swipe_after_time_is_refused_and_battle_finishes(admin, guest, fake_clock) -> None:
    battle_id = swipe_battle(admin)
    anna, boris = join(guest, admin, battle_id), join(guest, admin, battle_id)
    send_photo(anna, battle_id)
    boris_photo = send_photo(boris, battle_id).json()["id"]
    start_voting(admin, battle_id)

    fake_clock.advance(121)
    assert error_code_of(swipe(anna, boris_photo, True)) == "voting_closed"
    assert anna.get(f"/api/battles/{battle_id}").json()["status"] == "finished"


def test_standings_hidden_until_finished_then_ranked(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    guests = [join(guest, admin, battle_id) for _ in range(4)]
    ids = [
        send_photo(g, battle_id, name).json()["id"] for g, name in zip(guests, "АБВ", strict=False)
    ]
    start_voting(admin, battle_id)
    assert error_code_of(guest.get(f"/api/battles/{battle_id}/standings")) == "not_finished"

    # Б получает три «да», А два «да», В одно «да» и одно «нет».
    for voter in guests:
        for photo_id in ids:
            liked = {ids[0]: voter is not guests[3], ids[1]: True, ids[2]: voter is guests[0]}
            swipe(voter, photo_id, liked[photo_id])

    response = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1})
    assert response.json()["status"] == "finished"
    entries = guest.get(f"/api/battles/{battle_id}/standings").json()["entries"]
    assert [entry["photo"]["caption"] for entry in entries] == ["Б", "А", "В"]
    assert [(entry["likes"], entry["rank"]) for entry in entries] == [(3, 1), (2, 2), (1, 3)]
    assert guest.get(f"/api/battles/{battle_id}").json()["winner"]["caption"] == "Б"


def test_removed_photo_leaves_deck_and_standings(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna, boris, vera = (join(guest, admin, battle_id) for _ in range(3))
    send_photo(anna, battle_id)
    bad = send_photo(boris, battle_id).json()["id"]
    send_photo(vera, battle_id)
    start_voting(admin, battle_id)

    response = admin.post(f"/api/admin/battles/{battle_id}/photos/{bad}/remove")
    assert response.status_code == 200, response.text
    assert bad not in [photo["id"] for photo in deck(anna, battle_id)["photos"]]
    assert error_code_of(swipe(anna, bad, True)) == "voting_closed"
    admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1})
    entries = guest.get(f"/api/battles/{battle_id}/standings").json()["entries"]
    assert bad not in [entry["photo"]["id"] for entry in entries]


def test_hall_counts_swipers_and_admin_sees_live_standings(admin, guest) -> None:
    battle_id = swipe_battle(admin)
    anna, boris = join(guest, admin, battle_id), join(guest, admin, battle_id)
    send_photo(anna, battle_id)
    boris_photo = send_photo(boris, battle_id).json()["id"]
    start_voting(admin, battle_id)
    swipe(anna, boris_photo, True)

    battle = admin.get(f"/api/admin/battles/{battle_id}").json()
    assert battle["swipers"] == 1
    assert battle["standings"][0]["likes"] == 1


def test_duel_battle_has_no_swipe_endpoints(admin, guest) -> None:
    battle_id = create_battle(admin, photos=2)
    admin.post(f"/api/admin/battles/{battle_id}/start")
    voter = join(guest, admin, battle_id)
    assert error_code_of(voter.get(f"/api/battles/{battle_id}/deck")) == "not_found"
    assert error_code_of(admin.post(f"/api/admin/battles/{battle_id}/start-voting")) == (
        "not_collecting"
    )
