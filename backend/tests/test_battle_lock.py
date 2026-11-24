import multiprocessing
import time

from photo_battle.game import BattleLock


def _hold(path: str, entered, release) -> None:
    lock = BattleLock()
    lock.use_file(path)
    with lock:
        entered.set()
        release.wait(5)


def test_lock_excludes_other_processes(tmp_path) -> None:
    path = str(tmp_path / "battle.lock")
    ctx = multiprocessing.get_context("fork")
    entered, release = ctx.Event(), ctx.Event()
    other = ctx.Process(target=_hold, args=(path, entered, release))
    other.start()
    try:
        assert entered.wait(5)
        lock = BattleLock()
        lock.use_file(path)
        started = time.monotonic()
        ctx.Process(target=lambda: (time.sleep(0.3), release.set())).start()
        with lock:
            waited = time.monotonic() - started
        assert waited >= 0.25
    finally:
        release.set()
        other.join(5)
