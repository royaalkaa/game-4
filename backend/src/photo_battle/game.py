"""Турнирная логика: сетка, старт и закрытие раундов."""

import secrets
import threading
from datetime import datetime, timedelta

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from photo_battle import clock
from photo_battle.models import (
    Battle,
    BattleStatus,
    DecidedBy,
    Match,
    MatchStatus,
    Photo,
    RoundState,
    Vote,
)

log = structlog.get_logger()

# Все переходы состояния батла и запись голосов идут под этим lock, чтобы
# фоновая задача, запросы зрителей и кнопки ведущего не закрыли раунд дважды.
LOCK = threading.Lock()


def build_first_round(photo_ids: list[int]) -> list[tuple[int, int | None]]:
    """Пары первого раунда по слотам; второй элемент None означает проход без дуэли."""
    ids = list(photo_ids)
    for i in range(len(ids) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        ids[i], ids[j] = ids[j], ids[i]
    size = 1
    while size < len(ids):
        size *= 2
    match_count = size // 2
    # Проходы ставятся сначала в чётные слоты, потом в нечётные: так два прохода
    # реже встречаются во втором раунде, а в одном матче никогда нет двух пустых мест.
    slot_order = [*range(0, match_count, 2), *range(1, match_count, 2)]
    bye_slots = set(slot_order[: size - len(ids)])
    remaining = iter(ids)
    pairs: list[tuple[int, int | None]] = []
    for slot in range(match_count):
        photo_a = next(remaining)
        photo_b = None if slot in bye_slots else next(remaining)
        pairs.append((photo_a, photo_b))
    return pairs


def start_battle(db: Session, battle: Battle, now: datetime) -> None:
    photo_ids = list(
        db.scalars(select(Photo.id).where(Photo.battle_id == battle.id).order_by(Photo.id))
    )
    pairs = build_first_round(photo_ids)
    for slot, (photo_a, photo_b) in enumerate(pairs):
        match = Match(battle_id=battle.id, round=1, slot=slot, photo_a_id=photo_a)
        if photo_b is None:
            match.status = MatchStatus.FINISHED
            match.winner_id = photo_a
            match.decided_by = DecidedBy.BYE
        else:
            match.status = MatchStatus.PENDING
            match.photo_b_id = photo_b
        db.add(match)
    battle.status = BattleStatus.ACTIVE
    # Размер сетки равен удвоенному числу матчей первого раунда, раундов log2 от него.
    battle.total_rounds = (len(pairs) * 2).bit_length() - 1
    db.flush()
    start_round(db, battle, 1, now)


def start_round(db: Session, battle: Battle, round_no: int, now: datetime) -> None:
    ends_at = now + timedelta(seconds=battle.round_seconds)
    pending = db.scalars(
        select(Match).where(
            Match.battle_id == battle.id,
            Match.round == round_no,
            Match.status == MatchStatus.PENDING,
        )
    )
    for match in pending:
        match.status = MatchStatus.ACTIVE
        match.starts_at = now
        match.ends_at = ends_at
    battle.current_round = round_no
    battle.round_state = RoundState.RUNNING
    battle.round_ends_at = ends_at
    log.info("round_started", battle_id=battle.id, round=round_no)


def _decide(db: Session, match: Match) -> None:
    photo_a, photo_b = match.photo_a_id, match.photo_b_id
    votes = db.scalars(
        select(Vote).where(Vote.match_id == match.id).order_by(Vote.created_at, Vote.id)
    )
    counts = {photo_a: 0, photo_b: 0}
    last_index: dict[int | None, int] = {}
    for index, vote in enumerate(votes):
        counts[vote.photo_id] += 1
        last_index[vote.photo_id] = index
    if counts[photo_a] != counts[photo_b]:
        match.winner_id = photo_a if counts[photo_a] > counts[photo_b] else photo_b
        match.decided_by = DecidedBy.VOTES
    elif counts[photo_a] > 0:
        # Итоговое число голосов первым набрало то фото, чей последний голос пришёл раньше.
        a_first = last_index[photo_a] < last_index[photo_b]
        match.winner_id = photo_a if a_first else photo_b
        match.decided_by = DecidedBy.TIE
    else:
        match.winner_id = secrets.choice([photo_a, photo_b])
        match.decided_by = DecidedBy.LOT
    match.status = MatchStatus.FINISHED


def close_round(db: Session, battle: Battle, now: datetime) -> None:
    round_no = battle.current_round
    matches = list(
        db.scalars(
            select(Match)
            .where(Match.battle_id == battle.id, Match.round == round_no)
            .order_by(Match.slot)
        )
    )
    for match in matches:
        if match.status == MatchStatus.ACTIVE:
            _decide(db, match)
    log.info("round_closed", battle_id=battle.id, round=round_no)
    if round_no == battle.total_rounds:
        battle.status = BattleStatus.FINISHED
        battle.round_state = None
        battle.round_ends_at = None
        log.info("battle_finished", battle_id=battle.id, winner_id=matches[0].winner_id)
        return
    next_round = round_no + 1
    for slot in range(len(matches) // 2):
        db.add(
            Match(
                battle_id=battle.id,
                round=next_round,
                slot=slot,
                status=MatchStatus.PENDING,
                photo_a_id=matches[2 * slot].winner_id,
                photo_b_id=matches[2 * slot + 1].winner_id,
            )
        )
    db.flush()
    if battle.auto_advance:
        start_round(db, battle, next_round, now)
    else:
        battle.round_state = RoundState.BREAK
        battle.round_ends_at = None


def _is_due(battle: Battle, now: datetime) -> bool:
    return (
        battle.status == BattleStatus.ACTIVE
        and battle.round_state == RoundState.RUNNING
        and battle.round_ends_at is not None
        and battle.round_ends_at <= now
    )


def close_if_due(db: Session, battle: Battle) -> None:
    if not _is_due(battle, clock.now()):
        return
    with LOCK:
        db.refresh(battle)
        now = clock.now()
        if _is_due(battle, now):
            close_round(db, battle, now)
            db.commit()


def close_all_due(session_factory: sessionmaker[Session]) -> None:
    with session_factory() as db:
        due_ids = list(
            db.scalars(
                select(Battle.id).where(
                    Battle.status == BattleStatus.ACTIVE,
                    Battle.round_state == RoundState.RUNNING,
                    Battle.round_ends_at <= clock.now(),
                )
            )
        )
        for battle_id in due_ids:
            battle = db.get(Battle, battle_id)
            if battle is not None:
                close_if_due(db, battle)
