import threading
from datetime import timedelta

from helpers import (
    active_matches,
    create_battle,
    join,
    join_code,
    parse_time,
    start_battle,
    try_join,
)
from sqlalchemy import func, select

from photo_battle import game
from photo_battle.models import Vote


def error_code(response) -> str:
    return response.json()["error"]["code"]


def test_join_code_expires_after_60_seconds(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 2, round_seconds=600)
    code = join_code(admin, battle_id)

    fake_clock.advance(30)
    assert join_code(admin, battle_id) != code

    fake_clock.advance(29)
    response, voter = try_join(guest, battle_id, code)
    assert response.status_code == 200
    assert voter is not None

    fake_clock.advance(1)
    response, voter = try_join(guest, battle_id, code)
    assert response.status_code == 400
    assert error_code(response) == "code_invalid"
    assert voter is None


def test_join_link_and_qr(admin, guest) -> None:
    battle_id = start_battle(admin, 2)
    link = admin.get(f"/api/admin/battles/{battle_id}/join").json()
    assert link["url"].startswith(f"http://hall.test/join/{battle_id}?code=")
    assert len(link["url"].split("code=", 1)[1]) == 8
    assert link["valid_until"].endswith("Z")

    qr = admin.get(f"/api/admin/battles/{battle_id}/qr.svg")
    assert qr.status_code == 200
    assert qr.headers["content-type"].startswith("image/svg+xml")
    assert qr.headers["cache-control"] == "no-store"
    assert b"<svg" in qr.content

    draft = create_battle(admin, 2)
    response = admin.get(f"/api/admin/battles/{draft}/qr.svg")
    assert response.status_code == 409
    assert error_code(response) == "not_active"


def test_join_rules(admin, guest) -> None:
    battle_id = start_battle(admin, 2)
    draft = create_battle(admin, 2)
    response, _ = try_join(guest, draft, "whatever")
    assert response.status_code == 404

    response, _ = try_join(guest, battle_id, "badcode1")
    assert error_code(response) == "code_invalid"

    voter = join(guest, admin, battle_id)
    assert voter.get(f"/api/battles/{battle_id}").json()["joined"] is True
    assert guest.get(f"/api/battles/{battle_id}").json()["joined"] is False
    repeat = guest.post(
        f"/api/battles/{battle_id}/join",
        json={"code": "stale"},
        headers={"Cookie": voter.cookie},
    )
    assert repeat.json() == {"ok": True}
    assert admin.get(f"/api/admin/battles/{battle_id}").json()["voters"] == 1

    admin.post(f"/api/admin/battles/{battle_id}/stop")
    response, _ = try_join(guest, battle_id, "whatever")
    assert response.status_code == 409
    assert error_code(response) == "battle_closed"


def test_second_vote_is_rejected(admin, guest) -> None:
    battle_id = start_battle(admin, 2)
    match = active_matches(admin, battle_id)[0]
    voter = join(guest, admin, battle_id)

    assert voter.vote(match["id"], match["photo_a"]["id"]).status_code == 200
    response = voter.vote(match["id"], match["photo_b"]["id"])
    assert response.status_code == 409
    assert error_code(response) == "already_voted"


def test_concurrent_double_vote_counts_once(app, admin, guest) -> None:
    battle_id = start_battle(admin, 2)
    match = active_matches(admin, battle_id)[0]
    voter = join(guest, admin, battle_id)
    barrier = threading.Barrier(2)
    statuses: list[int] = []

    def cast() -> None:
        barrier.wait()
        statuses.append(voter.vote(match["id"], match["photo_a"]["id"]).status_code)

    threads = [threading.Thread(target=cast) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(statuses) == [200, 409]
    with app.state.session_factory() as db:
        count = db.scalar(select(func.count(Vote.id)).where(Vote.match_id == match["id"]))
    assert count == 1


def test_vote_validation(admin, guest) -> None:
    battle_id = start_battle(admin, 2)
    match = active_matches(admin, battle_id)[0]

    response = guest.post(f"/api/matches/{match['id']}/vote", json={"photo_id": 1})
    assert response.status_code == 401
    assert error_code(response) == "not_joined"
    response = guest.get(f"/api/battles/{battle_id}/next-match")
    assert error_code(response) == "not_joined"

    voter = join(guest, admin, battle_id)
    response = voter.vote(match["id"], 999999)
    assert response.status_code == 400
    assert error_code(response) == "bad_photo"


def test_score_hidden_until_vote_and_next_match_flow(admin, guest) -> None:
    battle_id = start_battle(admin, 4, round_seconds=120)
    first, second = join(guest, admin, battle_id), join(guest, admin, battle_id)

    offered = first.get(f"/api/battles/{battle_id}/next-match").json()["match"]
    assert offered["slot"] == 0
    assert offered["votes_a"] is None and offered["votes_b"] is None
    assert offered["my_vote"] is None

    voted = first.vote(offered["id"], offered["photo_a"]["id"]).json()
    assert (voted["votes_a"], voted["votes_b"]) == (1, 0)
    assert voted["my_vote"] == offered["photo_a"]["id"]

    other_view = second.get(f"/api/battles/{battle_id}/next-match").json()["match"]
    assert other_view["id"] == offered["id"]
    assert other_view["total_votes"] == 1
    assert other_view["votes_a"] is None

    following = first.get(f"/api/battles/{battle_id}/next-match").json()["match"]
    assert following["slot"] == 1
    first.vote(following["id"], following["photo_b"]["id"])
    assert first.get(f"/api/battles/{battle_id}/next-match").json() == {"match": None}

    admin_match = active_matches(admin, battle_id)[0]
    assert (admin_match["votes_a"], admin_match["votes_b"]) == (1, 0)


def test_score_hidden_from_everyone_but_admin_during_freeze(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 2, round_seconds=120, freeze_seconds=60)
    match = active_matches(admin, battle_id)[0]
    early, late = join(guest, admin, battle_id), join(guest, admin, battle_id)
    assert early.vote(match["id"], match["photo_a"]["id"]).json()["votes_a"] == 1

    fake_clock.advance(59)
    assert guest.get(f"/api/battles/{battle_id}").json()["frozen"] is False
    bracket = early.get(f"/api/battles/{battle_id}/bracket").json()
    assert bracket["rounds"][0]["matches"][0]["votes_a"] == 1

    fake_clock.advance(1)
    assert guest.get(f"/api/battles/{battle_id}").json()["frozen"] is True
    bracket = early.get(f"/api/battles/{battle_id}/bracket").json()
    assert bracket["rounds"][0]["matches"][0]["votes_a"] is None
    assert bracket["rounds"][0]["matches"][0]["total_votes"] == 1

    voted = late.vote(match["id"], match["photo_b"]["id"]).json()
    assert voted["votes_a"] is None and voted["votes_b"] is None

    admin_match = active_matches(admin, battle_id)[0]
    assert (admin_match["votes_a"], admin_match["votes_b"]) == (1, 1)


def test_vote_after_ends_at_is_rejected_even_if_round_not_closed(
    admin, guest, fake_clock, monkeypatch
) -> None:
    battle_id = start_battle(admin, 2, round_seconds=60)
    match = active_matches(admin, battle_id)[0]
    voter = join(guest, admin, battle_id)

    monkeypatch.setattr(game, "close_if_due", lambda db, battle: None)
    fake_clock.current = parse_time(match["ends_at"])
    response = voter.vote(match["id"], match["photo_a"]["id"])
    assert response.status_code == 409
    assert error_code(response) == "match_closed"

    fake_clock.current -= timedelta(milliseconds=1)
    assert voter.vote(match["id"], match["photo_a"]["id"]).status_code == 200


def test_300_voters_from_one_ip(admin, guest, fake_clock) -> None:
    battle_id = start_battle(admin, 2, round_seconds=120)
    match = active_matches(admin, battle_id)[0]
    statuses = []
    for index in range(300):
        # 300 голосов за минуту: QR на экране меняется по ходу, как в зале.
        fake_clock.advance(0.2)
        voter = join(guest, admin, battle_id)
        photo = match["photo_a"] if index % 3 else match["photo_b"]
        statuses.append(voter.vote(match["id"], photo["id"]).status_code)

    assert statuses == [200] * 300
    final = active_matches(admin, battle_id)[0]
    assert final["total_votes"] == 300
    assert (final["votes_a"], final["votes_b"]) == (200, 100)
