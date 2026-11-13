import { useCallback } from 'react';
import { generatePath, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { routePaths, VOTER_POLL_MS } from '@/shared/config';
import { clockOffsetMs, usePolling } from '@/shared/lib';
import { Button, ButtonLink, Page, StateView } from '@/shared/ui';
import { BattleHeader, getBattle, getBracket } from '@/entities/battle';
import { BracketView } from '@/widgets/bracket';

export function BracketPage() {
  const { battleId = '' } = useParams();
  const load = useCallback(async () => {
    const [battle, bracket] = await Promise.all([getBattle(battleId), getBracket(battleId)]);
    return { battle, bracket, offsetMs: clockOffsetMs(battle.server_time, Date.now()) };
  }, [battleId]);
  const { data, error, refresh } = usePolling(load, VOTER_POLL_MS);

  if (!data) {
    if (error?.code === 'not_found') return <StateView kind="empty" title="Батл не найден" />;
    if (error) {
      return (
        <StateView
          kind="error"
          title="Не удалось загрузить сетку"
          message={error.message}
          action={<Button onClick={refresh}>Повторить</Button>}
        />
      );
    }
    return <StateView kind="loading" title="Загружаем сетку" />;
  }

  const { battle, bracket, offsetMs } = data;
  return (
    <Page>
      <ButtonLink to={generatePath(routePaths.battle, { battleId })} className="w-fit">
        <ArrowLeft aria-hidden size={18} />К батлу
      </ButtonLink>
      <BattleHeader battle={battle} offsetMs={offsetMs} />
      {battle.total_rounds === null || bracket.rounds.length === 0 ? (
        <StateView kind="empty" title="Сетка появится после запуска батла" />
      ) : (
        <BracketView bracket={bracket} totalRounds={battle.total_rounds} currentRound={battle.current_round} />
      )}
    </Page>
  );
}
