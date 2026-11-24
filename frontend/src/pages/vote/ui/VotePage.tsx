import { useCallback, useEffect, useState } from 'react';
import { generatePath, useParams } from 'react-router';
import { Network, Trophy } from 'lucide-react';
import { asApiError, type ApiError, type Match } from '@/shared/api';
import { routePaths, VOTE_RESULT_MS, VOTER_POLL_MS } from '@/shared/config';
import { clockOffsetMs, useBackdrop, usePolling } from '@/shared/lib';
import { Button, ButtonLink, Page, PhotoFrame, StaleBanner, StateView } from '@/shared/ui';
import { BattleHeader, getBattle, getBracket } from '@/entities/battle';
import { MatchCard } from '@/entities/match';
import { DuelVote, getNextMatch, VoteResult } from '@/features/vote';
import { selectVoteView } from '../model/selectView';
import { SwipeTopBar } from './SwipeTopBar';
import { SwipeVote } from './SwipeVote';

export function VotePage() {
  const { battleId = '' } = useParams();
  const load = useCallback(async () => {
    const battle = await getBattle(battleId);
    const offsetMs = clockOffsetMs(battle.server_time, Date.now());
    const bracket = battle.round_state === 'break' ? await getBracket(battleId) : null;
    return { battle, offsetMs, bracket };
  }, [battleId]);
  const polling = usePolling(load, VOTER_POLL_MS);
  const battle = polling.data?.battle;
  useBackdrop(battle?.background_url);

  const [next, setNext] = useState<{ round: number; match: Match | null } | undefined>();
  const [nextError, setNextError] = useState<ApiError | undefined>();
  const [lastVote, setLastVote] = useState<Match | null>(null);

  const round = battle?.current_round ?? null;
  const nextMatch = next && next.round === round ? next.match : undefined;
  const needNext =
    battle !== undefined &&
    battle.mode === 'duel' &&
    battle.joined &&
    battle.status === 'active' &&
    battle.round_state === 'running' &&
    lastVote === null &&
    nextMatch === undefined &&
    nextError === undefined;

  useEffect(() => {
    if (!needNext || round === null) return;
    let cancelled = false;
    getNextMatch(battleId).then(
      (response) => {
        if (!cancelled) setNext({ round, match: response.match });
      },
      (error: unknown) => {
        if (!cancelled) setNextError(asApiError(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [needNext, battleId, round]);

  useEffect(() => {
    if (!lastVote) return;
    const timer = setTimeout(() => {
      setLastVote(null);
      setNext(undefined);
    }, VOTE_RESULT_MS);
    return () => clearTimeout(timer);
  }, [lastVote]);

  // A late vote must not look accepted, so the page says it was refused and re-reads the round.
  const [lateRound, setLateRound] = useState<number | null>(null);
  const { refresh } = polling;
  const reloadNext = useCallback(
    (code: string) => {
      if (code === 'match_closed') {
        setLateRound(round);
        refresh();
      }
      setNext(undefined);
    },
    [round, refresh],
  );
  const lateVote = lateRound !== null && lateRound === round;

  const view = selectVoteView({
    battle,
    battleError: polling.error,
    nextMatch,
    nextMatchError: nextError,
    lastVote,
  });
  const bracketPath = generatePath(routePaths.bracket, { battleId });

  if (view.kind === 'loading' && !battle) {
    return <StateView kind="loading" title="Загружаем батл" />;
  }
  if (view.kind === 'not_found') {
    return (
      <StateView kind="empty" title="Батл не найден" message="Проверь ссылку или отсканируй QR на экране зала" />
    );
  }
  if (view.kind === 'error' && !battle) {
    return (
      <StateView
        kind="error"
        title="Не удалось загрузить батл"
        message={view.message}
        action={<Button onClick={polling.refresh}>Повторить</Button>}
      />
    );
  }
  if (!battle || !polling.data) return null;

  if (battle.mode === 'swipe') {
    // Swipe battles look like a dating app and stay phone-sized even on a laptop.
    return (
      <div className="theme-swipe min-h-svh">
        <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-3">
          <SwipeTopBar battle={battle} offsetMs={polling.data.offsetMs} />
          {polling.error && <StaleBanner message={polling.error.message} />}
          <SwipeVote battle={battle} battleId={battleId} refresh={polling.refresh} />
        </main>
      </div>
    );
  }

  const bracketLink = (
    <ButtonLink to={bracketPath}>
      <Network aria-hidden size={18} />
      Смотреть сетку
    </ButtonLink>
  );
  const roundMatches =
    polling.data.bracket?.rounds.find((entry) => entry.round === battle.current_round)?.matches ?? [];

  return (
    <Page>
      <BattleHeader battle={battle} offsetMs={polling.data.offsetMs} />
      {polling.error && <StaleBanner message={polling.error.message} />}
      {lateVote && view.kind !== 'duel' && view.kind !== 'result' && (
        <p role="status" className="text-danger">
          Голос не принят: дуэль уже закрыта.
        </p>
      )}
      {view.kind === 'loading' && <StateView kind="loading" title="Ищем дуэль для тебя" />}
      {view.kind === 'error' && (
        <StateView
          kind="error"
          title="Не удалось загрузить дуэль"
          message={view.message}
          action={
            <Button
              onClick={() => {
                setNextError(undefined);
                polling.refresh();
              }}
            >
              Повторить
            </Button>
          }
        />
      )}
      {view.kind === 'not_started' && <StateView kind="empty" title="Батл ещё не начался" />}
      {view.kind === 'not_joined' && (
        <StateView
          kind="forbidden"
          title="Нет доступа к голосованию"
          message="Отсканируй QR на экране зала, чтобы голосовать"
        />
      )}
      {view.kind === 'duel' && (
        <DuelVote key={view.match.id} match={view.match} onVoted={setLastVote} onStale={reloadNext} />
      )}
      {view.kind === 'result' && <VoteResult match={view.match} />}
      {view.kind === 'all_voted' && (
        <StateView
          kind="empty"
          title={lateVote ? 'В этом раунде больше не за что голосовать' : 'Ты проголосовал во всех дуэлях раунда'}
          action={bracketLink}
        />
      )}
      {view.kind === 'break' && (
        <section aria-label="Результаты раунда" className="flex flex-col gap-4">
          <StateView kind="empty" title="Раунд окончен, ждём ведущего" />
          <div className="grid gap-3 sm:grid-cols-2">
            {roundMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}
      {view.kind === 'finished' && (
        <section aria-label="Победитель" className="flex flex-col items-center gap-4 text-center">
          <p className="inline-flex items-center gap-2 text-2xl font-bold">
            <Trophy aria-hidden className="text-primary" size={28} />
            Победитель
          </p>
          {battle.winner && (
            <>
              <PhotoFrame
                src={battle.winner.url}
                alt={battle.winner.caption ?? 'Фото победителя'}
                className="h-[60svh] w-full"
              />
              {battle.winner.caption && <p className="text-xl">{battle.winner.caption}</p>}
            </>
          )}
          <ButtonLink variant="primary" size="lg" to={generatePath(routePaths.results, { battleId })}>
            Итоги батла
          </ButtonLink>
          {bracketLink}
        </section>
      )}
      {view.kind === 'stopped' && (
        <StateView kind="empty" title="Батл остановлен" message="Ведущий остановил батл" action={bracketLink} />
      )}
    </Page>
  );
}
