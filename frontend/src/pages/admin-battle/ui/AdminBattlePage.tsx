import { useCallback } from 'react';
import { generatePath, useParams } from 'react-router';
import { ArrowLeft, Ban, EyeOff, MonitorPlay, Play, SkipForward, Square, Users } from 'lucide-react';
import { routePaths, ADMIN_POLL_MS } from '@/shared/config';
import { clockOffsetMs, usePolling } from '@/shared/lib';
import { Button, ButtonLink, Page, StateView } from '@/shared/ui';
import { BattleHeader, getAdminBattle } from '@/entities/battle';
import { ActionButton, finishRound, nextRound, removePhoto, startBattle, stopBattle } from '@/features/battle-controls';
import { DraftPhotoGrid, PhotoUploader } from '@/features/draft-photos';
import { BracketView } from '@/widgets/bracket';

export function AdminBattlePage() {
  const { battleId = '' } = useParams();
  const load = useCallback(async () => {
    const battle = await getAdminBattle(battleId);
    return { battle, offsetMs: clockOffsetMs(battle.server_time, Date.now()) };
  }, [battleId]);
  const { data, error, refresh } = usePolling(load, ADMIN_POLL_MS);
  const backLink = (
    <ButtonLink to={routePaths.admin} className="w-fit">
      <ArrowLeft aria-hidden size={18} />
      Все батлы
    </ButtonLink>
  );

  if (!data) {
    if (error?.code === 'admin_required') {
      return (
        <StateView
          kind="forbidden"
          title="Нужен вход ведущего"
          action={
            <ButtonLink variant="primary" to={routePaths.admin}>
              Войти
            </ButtonLink>
          }
        />
      );
    }
    if (error?.code === 'not_found') return <StateView kind="empty" title="Батл не найден" action={backLink} />;
    if (error) {
      return (
        <StateView
          kind="error"
          title="Не удалось загрузить батл"
          message={error.message}
          action={<Button onClick={refresh}>Повторить</Button>}
        />
      );
    }
    return <StateView kind="loading" title="Загружаем батл" />;
  }

  const { battle, offsetMs } = data;
  const active = battle.status === 'active';

  return (
    <Page>
      {backLink}
      <BattleHeader battle={battle} offsetMs={offsetMs} />
      {error && (
        <p role="alert" className="text-danger">
          {error.message}
        </p>
      )}

      {battle.status === 'draft' && (
        <>
          <ActionButton
            label="Запустить батл"
            icon={<Play aria-hidden size={18} />}
            variant="primary"
            className="w-fit"
            confirm={{
              title: 'Запустить батл?',
              message: 'Сетка строится сразу, после запуска фото нельзя добавить или удалить.',
            }}
            action={() => startBattle(battleId)}
            onDone={refresh}
          />
          <PhotoUploader battleId={battleId} onUploaded={refresh} />
          <DraftPhotoGrid battleId={battleId} photos={battle.photos} onChanged={refresh} />
        </>
      )}

      {active && (
        <section aria-label="Управление" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 text-muted">
            <span className="inline-flex items-center gap-2">
              <Users aria-hidden size={18} />
              Вошло зрителей: {battle.voters}
            </span>
            {battle.frozen && (
              <span className="inline-flex items-center gap-2">
                <EyeOff aria-hidden size={18} />
                Заморозка: зрители не видят счёт
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {battle.round_state === 'break' && (
              <ActionButton
                label="Следующий раунд"
                icon={<SkipForward aria-hidden size={18} />}
                variant="primary"
                action={() => nextRound(battleId)}
                onDone={refresh}
              />
            )}
            {battle.round_state === 'running' && (
              <ActionButton
                label="Закончить раунд сейчас"
                icon={<Square aria-hidden size={18} />}
                confirm={{
                  title: 'Закончить раунд сейчас?',
                  message: 'Голосование в раунде закроется, победители дуэлей определятся по текущему счёту.',
                }}
                action={() => finishRound(battleId)}
                onDone={refresh}
              />
            )}
            <ButtonLink to={generatePath(routePaths.screen, { battleId })}>
              <MonitorPlay aria-hidden size={18} />
              Экран зала
            </ButtonLink>
            <ActionButton
              label="Остановить батл"
              icon={<Ban aria-hidden size={18} />}
              variant="danger"
              confirm={{
                title: 'Остановить батл?',
                message: 'Батл завершится без победителя, голосование закроется для всех.',
              }}
              action={() => stopBattle(battleId)}
              onDone={refresh}
            />
          </div>
        </section>
      )}

      {battle.status !== 'draft' && battle.total_rounds !== null && (
        <section aria-label="Сетка" className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Сетка</h2>
          <BracketView
            bracket={battle.bracket}
            totalRounds={battle.total_rounds}
            currentRound={battle.current_round}
            photoAction={(match, photo) =>
              active && match.status === 'active' && match.photo_b !== null ? (
                <ActionButton
                  label="Снять фото"
                  variant="danger"
                  className="min-h-8 px-2 py-1 text-sm"
                  confirm={{
                    title: 'Снять фото?',
                    message: 'Фото проиграет текущую дуэль и выбудет из батла.',
                  }}
                  action={() => removePhoto(battleId, photo.id)}
                  onDone={refresh}
                />
              ) : null
            }
          />
        </section>
      )}
    </Page>
  );
}
