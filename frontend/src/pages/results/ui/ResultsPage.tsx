import { useCallback } from 'react';
import { generatePath, useParams } from 'react-router';
import { Trophy } from 'lucide-react';
import { routePaths } from '@/shared/config';
import { useBackdrop, usePolling } from '@/shared/lib';
import { Button, ButtonLink, Page, PhotoFrame, StateView } from '@/shared/ui';
import { getBattle, getBracket, getStandings, roundTitle } from '@/entities/battle';
import { MatchCard } from '@/entities/match';
import { ShareButton } from '@/features/share-link';
import { BracketView } from '@/widgets/bracket';
import { StandingsList } from '@/widgets/swipe-reveal';

export function ResultsPage() {
  const { battleId = '' } = useParams();
  const load = useCallback(async () => {
    const battle = await getBattle(battleId);
    if (battle.mode === 'swipe') {
      const standings = battle.status === 'finished' ? (await getStandings(battleId)).entries : [];
      return { battle, bracket: { rounds: [] }, standings };
    }
    return { battle, bracket: await getBracket(battleId), standings: [] };
  }, [battleId]);
  const { data, error, refresh } = usePolling(load, null);
  useBackdrop(data?.battle.background_url);

  if (!data) {
    if (error?.code === 'not_found') return <StateView kind="empty" title="Батл не найден" />;
    if (error) {
      return (
        <StateView
          kind="error"
          title="Не удалось загрузить итоги"
          message={error.message}
          action={<Button onClick={refresh}>Повторить</Button>}
        />
      );
    }
    return <StateView kind="loading" title="Загружаем итоги" />;
  }

  const { battle, bracket, standings } = data;
  const winner = battle.winner;
  const shareUrl = window.location.origin + generatePath(routePaths.results, { battleId });
  if (battle.mode === 'swipe' && battle.status === 'finished' && winner) {
    return (
      <Page>
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Итоги: {battle.title}</h1>
          {battle.theme && <p className="text-muted">Тема: {battle.theme}</p>}
        </header>
        <section aria-label="Победитель" className="flex flex-col items-center gap-3 text-center">
          <p className="inline-flex items-center gap-2 text-2xl font-bold">
            <Trophy aria-hidden className="text-primary" size={28} />
            {winner.caption ?? 'Победитель'}
          </p>
          <PhotoFrame src={winner.url} alt={winner.caption ?? 'Фото победителя'} className="h-[50svh] w-full" />
          <ShareButton url={shareUrl} title={battle.title} />
        </section>
        <section aria-label="Все участники" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Все участники</h2>
          <StandingsList entries={standings} highlightId={battle.my_photo?.id ?? null} />
        </section>
      </Page>
    );
  }
  if (battle.status !== 'finished' || !winner || battle.total_rounds === null) {
    return (
      <StateView
        kind="empty"
        title="Итоги появятся после финала"
        action={<ButtonLink to={generatePath(routePaths.battle, { battleId })}>К батлу</ButtonLink>}
      />
    );
  }

  const totalRounds = battle.total_rounds;
  const path = bracket.rounds
    .flatMap((entry) => entry.matches)
    .filter((match) => match.winner_id === winner.id)
    .sort((a, b) => a.round - b.round);

  return (
    <Page>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Итоги: {battle.title}</h1>
        {battle.theme && <p className="text-muted">Тема: {battle.theme}</p>}
      </header>
      <section aria-label="Победитель" className="flex flex-col items-center gap-3 text-center">
        <p className="inline-flex items-center gap-2 text-2xl font-bold">
          <Trophy aria-hidden className="text-primary" size={28} />
          Победитель
        </p>
        <PhotoFrame src={winner.url} alt={winner.caption ?? 'Фото победителя'} className="h-[50svh] w-full" />
        {winner.caption && <p className="text-xl">{winner.caption}</p>}
        <ShareButton url={shareUrl} title={battle.title} />
      </section>
      <section aria-label="Путь победителя" className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Путь победителя</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {path.map((match) => (
            <li key={match.id} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-muted">{roundTitle(match.round, totalRounds)}</span>
              <MatchCard match={match} />
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Все дуэли" className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Все дуэли</h2>
        <BracketView bracket={bracket} totalRounds={totalRounds} currentRound={totalRounds} />
      </section>
    </Page>
  );
}
