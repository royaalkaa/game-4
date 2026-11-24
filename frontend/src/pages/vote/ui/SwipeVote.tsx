import { useCallback, useEffect, useState } from 'react';
import { generatePath } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { asApiError, type ApiError, type Battle, type Deck } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { usePolling } from '@/shared/lib';
import { Button, ButtonLink, StateView } from '@/shared/ui';
import { getStandings } from '@/entities/battle';
import { deleteMyPhoto, MyPhotoForm } from '@/features/my-photo';
import { getDeck, SwipeDeck } from '@/features/swipe';
import { SwipeReveal } from '@/widgets/swipe-reveal';
import { Radar } from './Radar';

interface SwipeVoteProps {
  battle: Battle;
  battleId: string;
  refresh: () => void;
}

function MyEntry({ battle, battleId, refresh }: SwipeVoteProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photo = battle.my_photo;

  if (!photo || editing) {
    return (
      <MyPhotoForm
        battleId={battleId}
        current={photo}
        onSaved={() => {
          setEditing(false);
          refresh();
        }}
        onCancel={photo ? () => setEditing(false) : undefined}
      />
    );
  }

  const remove = async () => {
    setError(null);
    try {
      await deleteMyPhoto(battleId);
      refresh();
    } catch (caught) {
      setError(asApiError(caught).message);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <Radar
        photoUrl={photo.url}
        title="Ты в игре"
        message={
          <>
            <span className="font-semibold text-fg">{photo.caption}</span>. Ждём начала голосования. Участников:{' '}
            {battle.participants}
          </>
        }
        action={
          <div className="flex gap-3">
            <Button onClick={() => setEditing(true)}>
              <Pencil aria-hidden size={18} />
              Заменить
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              <Trash2 aria-hidden size={18} />
              Убрать
            </Button>
          </div>
        }
      />
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Voting({ battle, battleId, refresh }: SwipeVoteProps) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDeck(battleId).then(
      (loaded) => {
        if (!cancelled) setDeck(loaded);
      },
      (caught: unknown) => {
        if (!cancelled) setError(asApiError(caught));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [battleId, attempt]);

  const finish = useCallback(() => setDone(true), []);

  if (error) {
    return (
      <StateView
        kind="error"
        title="Не удалось загрузить фото"
        message={error.message}
        action={
          <Button
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Повторить
          </Button>
        }
      />
    );
  }
  if (!deck) return <StateView kind="loading" title="Загружаем фото" />;
  if (done || deck.photos.length === 0) {
    return (
      <Radar
        photoUrl={battle.my_photo?.url}
        title={deck.total === 0 ? 'Голосовать пока не за кого' : 'Готово, ты оценил всех!'}
        message={
          battle.my_photo
            ? 'Твоё фото тоже в игре. Итоги покажут на экране зала'
            : 'Итоги покажут на экране зала'
        }
      />
    );
  }
  return <SwipeDeck photos={deck.photos} total={deck.total} onDone={finish} onClosed={refresh} />;
}

function Finished({ battle, battleId }: SwipeVoteProps) {
  const load = useCallback(() => getStandings(battleId), [battleId]);
  const { data, error, refresh } = usePolling(load, null);

  if (!data) {
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
    return <StateView kind="loading" title="Считаем голоса" />;
  }
  const mine = data.entries.find((entry) => entry.photo.id === battle.my_photo?.id);
  return (
    <div className="flex flex-col gap-6">
      <SwipeReveal
        entries={data.entries}
        after={
          mine && (
            <p className="rounded-md border-2 border-primary bg-primary-soft px-4 py-3 text-center text-lg font-semibold">
              Твоё место: {mine.rank} из {data.entries.length}
            </p>
          )
        }
      />
      <ButtonLink to={generatePath(routePaths.results, { battleId })}>Таблица итогов</ButtonLink>
    </div>
  );
}

export function SwipeVote(props: SwipeVoteProps) {
  const { battle } = props;
  if (battle.status === 'finished') return <Finished {...props} />;
  if (battle.status === 'stopped') return <StateView kind="empty" title="Батл остановлен" message="Ведущий остановил батл" />;
  if (battle.status === 'draft') return <StateView kind="empty" title="Батл ещё не начался" />;
  if (!battle.joined) {
    return (
      <StateView kind="forbidden" title="Нет доступа" message="Отсканируй QR на экране зала, чтобы участвовать" />
    );
  }
  return battle.phase === 'collecting' ? <MyEntry {...props} /> : <Voting {...props} />;
}
