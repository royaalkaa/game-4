import { generatePath, Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { routePaths } from '@/shared/config';
import { usePolling } from '@/shared/lib';
import { Button, Page, StateView } from '@/shared/ui';
import { listAdminBattles, statusLabels } from '@/entities/battle';
import { getAdminMe, LoginForm } from '@/features/admin-auth';
import { CreateBattleForm } from '@/features/create-battle';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

function BattleList() {
  const { data, error, refresh } = usePolling(listAdminBattles, null);

  if (!data) {
    if (error) {
      return (
        <StateView
          kind="error"
          title="Не удалось загрузить батлы"
          message={error.message}
          action={<Button onClick={refresh}>Повторить</Button>}
        />
      );
    }
    return <StateView kind="loading" title="Загружаем батлы" />;
  }
  if (data.length === 0) {
    return <StateView kind="empty" title="Батлов пока нет" message="Создай первый батл в форме рядом" />;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {data.map((battle) => (
        <li key={battle.id}>
          <Link
            to={generatePath(routePaths.adminBattle, { battleId: String(battle.id) })}
            className="flex h-full items-center gap-3 rounded-md border-2 border-line-strong bg-surface p-4 shadow-hard-sm transition-colors duration-150 hover:bg-surface-hover"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{battle.title}</p>
              <p className="truncate text-sm text-muted">
                {statusLabels[battle.status]}. Фото: {battle.photo_count}. {dateFormat.format(new Date(battle.created_at))}
              </p>
            </div>
            <ChevronRight aria-hidden className="text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AdminPage() {
  const me = usePolling(getAdminMe, null);
  const navigate = useNavigate();

  if (!me.data) {
    if (me.error?.code === 'admin_required') {
      return (
        <Page>
          <LoginForm onSuccess={me.refresh} />
        </Page>
      );
    }
    if (me.error) {
      return (
        <StateView
          kind="error"
          title="Не удалось проверить вход"
          message={me.error.message}
          action={<Button onClick={me.refresh}>Повторить</Button>}
        />
      );
    }
    return <StateView kind="loading" title="Проверяем вход" />;
  }

  return (
    <Page wide>
      <h1 className="text-3xl font-bold sm:text-4xl">Батлы</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_400px] lg:gap-10">
        <BattleList />
        <CreateBattleForm
          onCreated={(battleId) =>
            void navigate(generatePath(routePaths.adminBattle, { battleId: String(battleId) }))
          }
        />
      </div>
    </Page>
  );
}
