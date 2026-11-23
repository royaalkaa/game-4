import { useCallback, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { EyeOff, Trophy } from 'lucide-react';
import { apiUrl } from '@/shared/api';
import { HALL_POLL_MS, QR_REFRESH_MS, routePaths } from '@/shared/config';
import { clockOffsetMs, useNow, usePolling } from '@/shared/lib';
import { ButtonLink, PhotoFrame, StaleBanner, StateView } from '@/shared/ui';
import { BattleHeader, getAdminBattle } from '@/entities/battle';
import { DuelTile } from './DuelTile';
import { JoinLinkText } from './JoinLinkText';

function Hall({ children }: { children: ReactNode }) {
  return <div className="theme-hall min-h-screen bg-canvas p-10 text-fg">{children}</div>;
}

export function ScreenPage() {
  const { battleId = '' } = useParams();
  const load = useCallback(async () => {
    const battle = await getAdminBattle(battleId);
    return { battle, offsetMs: clockOffsetMs(battle.server_time, Date.now()) };
  }, [battleId]);
  const { data, error } = usePolling(load, HALL_POLL_MS);
  const qrStamp = useNow(QR_REFRESH_MS);

  if (!data) {
    if (error?.code === 'admin_required') {
      return (
        <Hall>
          <StateView
            large
            kind="forbidden"
            title="Экран зала только для ведущего"
            message="Войди как ведущий в этом браузере"
            action={
              <ButtonLink variant="primary" size="lg" to={routePaths.admin}>
                Войти
              </ButtonLink>
            }
          />
        </Hall>
      );
    }
    if (error?.code === 'not_found') {
      return (
        <Hall>
          <StateView large kind="empty" title="Батл не найден" />
        </Hall>
      );
    }
    return (
      <Hall>
        {error ? (
          <StateView large kind="error" title="Нет связи с сервером" message={error.message} />
        ) : (
          <StateView large kind="loading" title="Загрузка" />
        )}
      </Hall>
    );
  }

  const { battle, offsetMs } = data;

  if (battle.status === 'finished' && battle.winner) {
    return (
      <div className="theme-hall fixed inset-0 flex flex-col bg-canvas text-fg">
        <PhotoFrame
          src={battle.winner.url}
          alt={battle.winner.caption ?? 'Фото победителя'}
          className="min-h-0 flex-1 rounded-none"
        />
        <p className="flex items-center justify-center gap-4 p-6 text-6xl font-bold">
          <Trophy aria-hidden className="text-primary" size={64} />
          Победитель{battle.winner.caption ? `: ${battle.winner.caption}` : ''}
        </p>
      </div>
    );
  }

  if (battle.status !== 'active') {
    const title = battle.status === 'draft' ? 'Батл ещё не запущен' : 'Батл остановлен';
    return (
      <Hall>
        <BattleHeader large battle={battle} offsetMs={offsetMs} />
        <StateView large kind="empty" title={title} />
      </Hall>
    );
  }

  const roundMatches =
    battle.bracket.rounds
      .find((entry) => entry.round === battle.current_round)
      ?.matches.filter((match) => match.photo_b !== null) ?? [];
  const isBreak = battle.round_state === 'break';
  const qrSrc = `${apiUrl('adminQr', { battleId })}?${new URLSearchParams({ t: String(qrStamp) }).toString()}`;

  return (
    <Hall>
      {error && <StaleBanner message={error.message} />}
      <div className="grid grid-cols-[440px_1fr] gap-10">
        <aside className="flex flex-col items-center gap-4 text-center">
          <img src={qrSrc} alt="QR-код для входа в голосование" className="w-full rounded-2xl bg-qr p-4" />
          <p className="text-4xl font-semibold">Сканируй и голосуй</p>
          <JoinLinkText battleId={battleId} />
          <p className="text-2xl text-muted">Зрителей: {battle.voters}</p>
        </aside>
        <section className="flex flex-col gap-8">
          <BattleHeader large battle={battle} offsetMs={offsetMs} />
          {battle.round_state === 'running' && (
            <p className="inline-flex items-center gap-3 text-4xl font-semibold">
              <EyeOff aria-hidden size={40} />
              Счёт откроется в конце раунда
            </p>
          )}
          {isBreak && <h2 className="text-5xl font-bold">Раунд окончен. Результаты</h2>}
          {roundMatches.length === 0 ? (
            <StateView large kind="empty" title="В этом раунде нет дуэлей" />
          ) : (
            <div className={`grid gap-6 ${roundMatches.length > 2 ? 'grid-cols-4' : 'grid-cols-2'}`}>
              {roundMatches.map((match) => (
                <DuelTile
                  key={match.id}
                  match={match}
                  // The hall sees the score only after the duel ends, otherwise guests who
                  // have not voted yet follow the leader.
                  hideScore={match.status !== 'finished'}
                  compact={roundMatches.length > 2}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Hall>
  );
}
