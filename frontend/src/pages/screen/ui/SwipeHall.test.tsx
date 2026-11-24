import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeAdminBattle, makePhoto } from '@test/fixtures';
import { json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { AdminBattlePage } from '@/pages/admin-battle';
import { ScreenPage } from './ScreenPage';

const battleKey = `GET ${apiUrl('adminBattle', { battleId: 1 })}`;
const standings = [
  { photo: makePhoto(1, 'Анна'), likes: 5, dislikes: 1, rank: 1 },
  { photo: makePhoto(2, 'Борис'), likes: 2, dislikes: 4, rank: 2 },
];
const swipe = (overrides = {}) =>
  makeAdminBattle({
    mode: 'swipe',
    phase: 'voting',
    total_rounds: 1,
    bracket: { rounds: [] },
    photos: [makePhoto(1, 'Анна'), makePhoto(2, 'Борис')],
    standings,
    swipers: 7,
    ...overrides,
  });

function renderAt(path: string, element: React.ReactElement) {
  return renderRoutes(generatePath(path, { battleId: '1' }), [{ path, element }]);
}

describe('swipe hall screen', () => {
  it('shows participants while collecting photos', async () => {
    mockFetch({ [battleKey]: () => json(swipe({ phase: 'collecting', round_state: null, participants: 2 })) });
    renderAt(routePaths.screen, <ScreenPage />);
    expect(await screen.findByText('Сканируй и загрузи фото')).toBeInTheDocument();
    expect(screen.getByText('в игре')).toBeInTheDocument();
    expect(screen.getByText('Впиши имя')).toBeInTheDocument();
    expect(screen.getByText('Борис')).toBeInTheDocument();
  });

  it('shows the swipe hint and no score during voting', async () => {
    mockFetch({ [battleKey]: () => json(swipe()) });
    renderAt(routePaths.screen, <ScreenPage />);
    expect(await screen.findByText(/Проголосовало/)).toHaveTextContent('Проголосовало: 7');
    expect(screen.getByText('да')).toBeInTheDocument();
    expect(screen.getByText('нет')).toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('waits for the first photos with an empty hall', async () => {
    mockFetch({ [battleKey]: () => json(swipe({ phase: 'collecting', round_state: null, photos: [], participants: 0 })) });
    renderAt(routePaths.screen, <ScreenPage />);
    expect(await screen.findByText('Ждём первые фото')).toBeInTheDocument();
  });

  it('starts the count-up when voting ends', async () => {
    mockFetch({ [battleKey]: () => json(swipe({ status: 'finished', phase: null, round_state: null })) });
    renderAt(routePaths.screen, <ScreenPage />);
    expect(await screen.findByText('Считаем голоса…')).toBeInTheDocument();
    expect(screen.getByTestId('reveal-1')).toHaveAttribute('data-out', 'false');
  });
});

describe('swipe admin', () => {
  it('opens photo collecting from a draft', async () => {
    const fetchMock = mockFetch({
      [battleKey]: () => json(swipe({ status: 'draft', phase: null, round_state: null, photos: [] })),
      [`POST ${apiUrl('adminStart', { battleId: 1 })}`]: () => json(swipe({ phase: 'collecting' })),
    });
    renderAt(routePaths.adminBattle, <AdminBattlePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Открыть приём фото' }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);
    expect(screen.getByText(/Фото пришлют гости/)).toBeInTheDocument();
  });

  it('starts voting after confirmation', async () => {
    const fetchMock = mockFetch({
      [battleKey]: () => json(swipe({ phase: 'collecting', round_state: null })),
      [`POST ${apiUrl('adminStartVoting', { battleId: 1 })}`]: () => json(swipe()),
    });
    renderAt(routePaths.adminBattle, <AdminBattlePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Начать голосование' }));
    const dialogButtons = await screen.findAllByRole('button', { name: 'Начать голосование' });
    await userEvent.click(dialogButtons.at(-1)!);
    expect(fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/start-voting'))).toBe(true);
  });

  it('shows the live score only to the host during voting', async () => {
    mockFetch({ [battleKey]: () => json(swipe()) });
    renderAt(routePaths.adminBattle, <AdminBattlePage />);
    expect(await screen.findByText('Счёт видишь только ты')).toBeInTheDocument();
    expect(screen.getByLabelText('Да: 5')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Снять' })).toHaveLength(2);
  });
});
