import pytest
from helpers import create_battle, start_battle

from photo_battle.game import build_first_round


@pytest.mark.parametrize(
    ("photos", "matches", "byes"),
    [(2, 1, 0), (5, 4, 3), (8, 4, 0), (16, 8, 0)],
)
def test_first_round_shape(photos: int, matches: int, byes: int) -> None:
    ids = list(range(100, 100 + photos))
    pairs = build_first_round(ids)

    assert len(pairs) == matches
    assert sum(1 for _, b in pairs if b is None) == byes
    used = [p for pair in pairs for p in pair if p is not None]
    assert sorted(used) == ids
    assert all(a is not None for a, _ in pairs)


def test_byes_fill_even_slots_first() -> None:
    pairs = build_first_round(list(range(6)))
    bye_slots = {slot for slot, (_, b) in enumerate(pairs) if b is None}
    assert bye_slots == {0, 2}


def test_five_photos_give_three_byes_via_api(admin) -> None:
    battle_id = start_battle(admin, 5)
    battle = admin.get(f"/api/admin/battles/{battle_id}").json()

    assert battle["total_rounds"] == 3
    first = battle["bracket"]["rounds"][0]["matches"]
    byes = [m for m in first if m["decided_by"] == "bye"]
    assert len(byes) == 3
    for match in byes:
        assert match["photo_b"] is None
        assert match["status"] == "finished"
        assert match["winner_id"] == match["photo_a"]["id"]
    duels = [m for m in first if m["decided_by"] is None]
    assert len(duels) == 1
    assert duels[0]["status"] == "active"


def test_sixteen_photos_four_rounds(admin) -> None:
    battle_id = start_battle(admin, 16)
    battle = admin.get(f"/api/admin/battles/{battle_id}").json()
    assert battle["total_rounds"] == 4
    assert len(battle["bracket"]["rounds"][0]["matches"]) == 8


def test_start_requires_two_photos(admin) -> None:
    battle_id = create_battle(admin, 1)
    response = admin.post(f"/api/admin/battles/{battle_id}/start")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "not_enough_photos"
