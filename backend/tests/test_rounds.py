from datetime import timedelta

from helpers import START, active_matches, join, parse_time, start_battle

from photo_battle import game
from photo_battle.models import Battle, BattleStatus


def test_round_closes_exactly_at_ends_at(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 4, round_seconds=60)
    ends_at = parse_time(guest.get(f"/api/battles/{battle_id}").json()["round_ends_at"])

    fake_clock.current = ends_at - timedelta(milliseconds=1)
    battle = guest.get(f"/api/battles/{battle_id}").json()
    assert battle["round_state"] == "running"

    fake_clock.current = ends_at
    battle = guest.get(f"/api/battles/{battle_id}").json()
    assert battle["round_state"] == "break"
    assert battle["current_round"] == 1
    assert battle["round_ends_at"] is None
    rounds = guest.get(f"/api/battles/{battle_id}/bracket").json()["rounds"]
    assert all(m["status"] == "finished" for m in rounds[0]["matches"])
    assert [m["status"] for m in rounds[1]["matches"]] == ["pending"]


def test_auto_advance_starts_next_round(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 4, round_seconds=60, auto_advance=True)
    ends_at = parse_time(guest.get(f"/api/battles/{battle_id}").json()["round_ends_at"])

    fake_clock.current = ends_at
    battle = guest.get(f"/api/battles/{battle_id}").json()
    assert battle["round_state"] == "running"
    assert battle["current_round"] == 2
    assert parse_time(battle["round_ends_at"]) == ends_at + timedelta(seconds=60)


def test_manual_finish_and_next_round(admin, fake_clock) -> None:
    battle_id = start_battle(admin, 4)

    response = admin.post(f"/api/admin/battles/{battle_id}/next-round")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "round_not_finished"

    fake_clock.advance(10)
    battle = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1}).json()
    assert battle["round_state"] == "break"
    assert all(m["decided_by"] == "lot" for m in battle["bracket"]["rounds"][0]["matches"])

    response = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "round_not_running"

    battle = admin.post(f"/api/admin/battles/{battle_id}/next-round").json()
    assert battle["round_state"] == "running"
    assert battle["current_round"] == 2
    assert parse_time(battle["round_ends_at"]) == fake_clock.current + timedelta(seconds=60)
    final = battle["bracket"]["rounds"][1]["matches"][0]
    assert final["status"] == "active"

    battle = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 2}).json()
    assert battle["status"] == "finished"
    assert battle["round_state"] is None
    assert battle["winner"]["id"] == battle["bracket"]["rounds"][1]["matches"][0]["winner_id"]


def test_finish_round_ignores_round_started_by_auto_advance(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 4, round_seconds=60, auto_advance=True)
    ends_at = parse_time(guest.get(f"/api/battles/{battle_id}").json()["round_ends_at"])

    fake_clock.current = ends_at
    response = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "round_not_running"

    battle = admin.get(f"/api/admin/battles/{battle_id}").json()
    assert battle["current_round"] == 2
    assert battle["round_state"] == "running"


def test_eight_photos_auto_advance_reach_finished(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 8, round_seconds=30, auto_advance=True)
    for _ in range(3):
        ends_at = parse_time(guest.get(f"/api/battles/{battle_id}").json()["round_ends_at"])
        fake_clock.current = ends_at

    battle = guest.get(f"/api/battles/{battle_id}").json()
    assert battle["status"] == "finished"
    assert fake_clock.current == START + timedelta(seconds=90)
    assert battle["winner"] is not None
    assert battle["winner"]["caption"] is not None

    rounds = guest.get(f"/api/battles/{battle_id}/bracket").json()["rounds"]
    assert [len(r["matches"]) for r in rounds] == [4, 2, 1]
    for match in (m for r in rounds for m in r["matches"]):
        assert match["winner_id"] is not None
        assert match["decided_by"] == "lot"
        assert match["votes_a"] == 0


def test_tie_goes_to_photo_that_reached_final_count_first(app, admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 2)
    match = active_matches(admin, battle_id)[0]
    photo_a, photo_b = match["photo_a"]["id"], match["photo_b"]["id"]

    for photo_id in (photo_a, photo_b, photo_b, photo_a):
        voter = join(guest, admin, battle_id)
        fake_clock.advance(1)
        assert voter.vote(match["id"], photo_id).status_code == 200

    battle = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1}).json()
    final = battle["bracket"]["rounds"][0]["matches"][0]
    assert (final["votes_a"], final["votes_b"]) == (2, 2)
    assert final["decided_by"] == "tie"
    assert final["winner_id"] == photo_b


def test_more_votes_win(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 2)
    match = active_matches(admin, battle_id)[0]
    photo_b = match["photo_b"]["id"]
    for photo_id in (photo_b, match["photo_a"]["id"], photo_b):
        assert join(guest, admin, battle_id).vote(match["id"], photo_id).status_code == 200

    battle = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1}).json()
    final = battle["bracket"]["rounds"][0]["matches"][0]
    assert final["decided_by"] == "votes"
    assert final["winner_id"] == photo_b


def test_empty_duel_is_decided_by_lot(admin) -> None:
    battle_id = start_battle(admin, 2)
    match = active_matches(admin, battle_id)[0]
    battle = admin.post(f"/api/admin/battles/{battle_id}/finish-round", json={"round": 1}).json()
    final = battle["bracket"]["rounds"][0]["matches"][0]
    assert final["decided_by"] == "lot"
    assert final["winner_id"] in (match["photo_a"]["id"], match["photo_b"]["id"])


def test_removed_photo_loses_its_match(admin) -> None:
    battle_id = start_battle(admin, 4)
    match = active_matches(admin, battle_id)[0]
    loser = match["photo_a"]["id"]

    battle = admin.post(f"/api/admin/battles/{battle_id}/photos/{loser}/remove").json()
    decided = next(m for m in battle["bracket"]["rounds"][0]["matches"] if m["id"] == match["id"])
    assert decided["decided_by"] == "removal"
    assert decided["winner_id"] == match["photo_b"]["id"]

    response = admin.post(f"/api/admin/battles/{battle_id}/photos/{loser}/remove")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "not_in_active_match"


def test_stop_battle(admin, guest) -> None:
    battle_id = start_battle(admin, 2)
    battle = admin.post(f"/api/admin/battles/{battle_id}/stop").json()
    assert battle["status"] == "stopped"
    assert battle["round_state"] is None
    response = admin.post(f"/api/admin/battles/{battle_id}/stop")
    assert response.json()["error"]["code"] == "not_active"


def test_background_tick_closes_due_rounds(app, admin, fake_clock) -> None:
    battle_id = start_battle(admin, 2, round_seconds=30)
    fake_clock.advance(30)
    game.close_all_due(app.state.session_factory)
    with app.state.session_factory() as db:
        assert db.get(Battle, battle_id).status == BattleStatus.FINISHED
