import { useEffect, useState } from 'react';
import { generatePath, useNavigate, useParams, useSearchParams } from 'react-router';
import { asApiError, type ApiError } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { Button, ButtonLink, StateView } from '@/shared/ui';
import { joinBattle } from '@/features/join-battle';

const RESCAN = 'Код устарел. Отсканируй QR на экране зала ещё раз';

export function JoinPage() {
  const { battleId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const navigate = useNavigate();
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    joinBattle(battleId, code).then(
      () => {
        if (!cancelled) void navigate(generatePath(routePaths.battle, { battleId }), { replace: true });
      },
      (caught: unknown) => {
        if (!cancelled) setError(asApiError(caught));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [battleId, code, navigate, attempt]);

  if (!code || error?.code === 'code_invalid') {
    return <StateView kind="forbidden" title="Не получилось войти" message={RESCAN} />;
  }
  if (error?.code === 'not_found') {
    return <StateView kind="empty" title="Батл не найден" message={error.message} />;
  }
  if (error?.code === 'battle_closed') {
    return (
      <StateView
        kind="empty"
        title="Голосование закрыто"
        message={error.message}
        action={<ButtonLink to={generatePath(routePaths.battle, { battleId })}>К батлу</ButtonLink>}
      />
    );
  }
  if (error) {
    return (
      <StateView
        kind="error"
        title="Не получилось войти"
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
  return <StateView kind="loading" title="Входим в батл" />;
}
