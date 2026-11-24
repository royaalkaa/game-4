import { generatePath } from 'react-router';
import { Ban, Camera, Flag, MonitorPlay, Play, Users, Vote } from 'lucide-react';
import type { AdminBattle } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';
import { ActionButton, finishRound, removePhoto, startBattle, startVoting, stopBattle } from '@/features/battle-controls';
import { DraftPhotoGrid, PhotoUploader } from '@/features/draft-photos';
import { StandingsList } from '@/widgets/swipe-reveal';

interface SwipeAdminProps {
  battle: AdminBattle;
  battleId: string;
  refresh: () => void;
}

export function SwipeAdmin({ battle, battleId, refresh }: SwipeAdminProps) {
  const active = battle.status === 'active';
  const collecting = active && battle.phase === 'collecting';
  const voting = active && battle.phase === 'voting';
  const screenLink = (
    <ButtonLink to={generatePath(routePaths.screen, { battleId })} target="_blank" rel="noopener">
      <MonitorPlay aria-hidden size={18} />
      Экран зала
    </ButtonLink>
  );
  const stop = (
    <ActionButton
      label="Остановить батл"
      icon={<Ban aria-hidden size={18} />}
      variant="danger"
      confirm={{ title: 'Остановить батл?', message: 'Батл завершится без победителя, голосование закроется для всех.' }}
      action={() => stopBattle(battleId)}
      onDone={refresh}
    />
  );

  return (
    <>
      {battle.status === 'draft' && (
        <section aria-label="Запуск" className="flex flex-col gap-3">
          <p className="text-muted">
            Режим свайпов. Гости сканируют QR, загружают фото и имя, потом свайпают: вправо да, влево нет.
          </p>
          <ActionButton
            label="Открыть приём фото"
            icon={<Camera aria-hidden size={18} />}
            variant="primary"
            className="w-fit"
            action={() => startBattle(battleId)}
            onDone={refresh}
          />
        </section>
      )}

      {active && (
        <section aria-label="Управление" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 text-muted">
            <span className="inline-flex items-center gap-2">
              <Users aria-hidden size={18} />
              Вошло: {battle.voters}
            </span>
            <span>Участников с фото: {battle.participants}</span>
            {voting && <span>Проголосовало: {battle.swipers}</span>}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {collecting && (
              <ActionButton
                label="Начать голосование"
                icon={<Play aria-hidden size={18} />}
                variant="primary"
                confirm={{
                  title: 'Начать голосование?',
                  message: 'Приём фото закроется, гости начнут свайпать. Нужно хотя бы 2 фото.',
                }}
                action={() => startVoting(battleId)}
                onDone={refresh}
              />
            )}
            {voting && (
              <ActionButton
                label="Закончить и подвести итоги"
                icon={<Flag aria-hidden size={18} />}
                variant="primary"
                confirm={{
                  title: 'Закончить голосование?',
                  message: 'Голосование закроется, на экране зала начнётся подсчёт.',
                }}
                action={() => finishRound(battleId, 1)}
                onDone={refresh}
              />
            )}
            {screenLink}
            {stop}
          </div>
        </section>
      )}

      {(battle.status === 'draft' || collecting) && (
        <>
          <PhotoUploader battleId={battleId} onUploaded={refresh} />
          <DraftPhotoGrid
            battleId={battleId}
            photos={battle.photos}
            onChanged={refresh}
            emptyMessage="Фото пришлют гости после входа по QR. Можно добавить и свои"
          />
        </>
      )}

      {(voting || battle.status === 'finished') && (
        <section aria-label="Счёт" className="flex flex-col gap-3">
          <h2 className="inline-flex items-center gap-2 text-xl font-semibold">
            <Vote aria-hidden size={22} />
            {voting ? 'Счёт видишь только ты' : 'Итоги'}
          </h2>
          <StandingsList
            entries={battle.standings}
            action={(photo) =>
              voting ? (
                <ActionButton
                  label="Снять"
                  variant="danger"
                  className="min-h-8 px-2 py-1 text-sm"
                  confirm={{ title: 'Снять фото?', message: 'Фото выпадет из голосования и итогов.' }}
                  action={() => removePhoto(battleId, photo.id)}
                  onDone={refresh}
                />
              ) : null
            }
          />
          {battle.status === 'finished' && screenLink}
        </section>
      )}
    </>
  );
}
