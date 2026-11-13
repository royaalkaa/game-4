import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeAdminBattle, makePhoto } from '@test/fixtures';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { AdminBattlePage } from './AdminBattlePage';

const battleKey = `GET ${apiUrl('adminBattle', { battleId: 1 })}`;
const draft = makeAdminBattle({
  status: 'draft',
  round_state: null,
  current_round: null,
  total_rounds: null,
  round_ends_at: null,
  bracket: { rounds: [] },
});

function renderPage() {
  return renderRoutes(generatePath(routePaths.adminBattle, { battleId: '1' }), [
    { path: routePaths.adminBattle, element: <AdminBattlePage /> },
  ]);
}

describe('AdminBattlePage', () => {
  it('shows loading first', () => {
    mockFetch({ [battleKey]: () => new Promise<Response>(() => undefined) });
    renderPage();
    expect(screen.getByText('Загружаем батл')).toBeInTheDocument();
  });

  it('shows no rights without the admin cookie', async () => {
    mockFetch({ [battleKey]: () => apiError(401, 'admin_required', 'Нужен вход') });
    renderPage();
    expect(await screen.findByText('Нужен вход ведущего')).toBeInTheDocument();
  });

  it('shows not found as empty', async () => {
    mockFetch({ [battleKey]: () => apiError(404, 'not_found', 'Нет такого') });
    renderPage();
    expect(await screen.findByText('Батл не найден')).toBeInTheDocument();
  });

  it('shows the API message on error', async () => {
    mockFetch({ [battleKey]: () => apiError(500, 'internal', 'Ошибка базы') });
    renderPage();
    expect(await screen.findByText('Ошибка базы')).toBeInTheDocument();
  });

  it('shows the empty photo list of a fresh draft', async () => {
    mockFetch({ [battleKey]: () => json({ ...draft, photos: [] }) });
    renderPage();
    expect(await screen.findByText('Фото пока нет')).toBeInTheDocument();
  });

  it('starts the battle only after confirming in a dialog named by the action', async () => {
    let started = false;
    mockFetch({
      [battleKey]: () => json(started ? makeAdminBattle() : draft),
      [`POST ${apiUrl('adminStart', { battleId: 1 })}`]: () => {
        started = true;
        return json(makeAdminBattle());
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Запустить батл' }));
    const dialog = screen.getByRole('dialog', { name: 'Запустить батл?' });
    expect(started).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Запустить батл' }));
    expect(await screen.findByText('Вошло зрителей: 42')).toBeInTheDocument();
    expect(started).toBe(true);
  });

  it('shows the API message when the start is rejected', async () => {
    mockFetch({
      [battleKey]: () => json(draft),
      [`POST ${apiUrl('adminStart', { battleId: 1 })}`]: () =>
        apiError(409, 'not_enough_photos', 'Нужно хотя бы 2 фото'),
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Запустить батл' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Запустить батл' }));
    expect(await screen.findByText('Нужно хотя бы 2 фото')).toBeInTheDocument();
  });

  it('deletes a draft photo after confirmation', async () => {
    let deleted = false;
    mockFetch({
      [battleKey]: () => json(deleted ? { ...draft, photos: draft.photos.slice(1) } : draft),
      [`DELETE ${apiUrl('adminPhoto', { battleId: 1, photoId: 1 })}`]: () => {
        deleted = true;
        return json({ ok: true });
      },
    });
    renderPage();
    expect(await screen.findByText('Фото: 4')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Удалить' })[0]!);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить фото' }));
    expect(await screen.findByText('Фото: 3')).toBeInTheDocument();
  });

  it('cancels a dialog without calling the API', async () => {
    const fetchMock = mockFetch({ [battleKey]: () => json(makeAdminBattle()) });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Остановить батл' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('shows live controls of an active battle', async () => {
    mockFetch({ [battleKey]: () => json(makeAdminBattle({ frozen: true })) });
    renderPage();
    expect(await screen.findByText('Вошло зрителей: 42')).toBeInTheDocument();
    expect(screen.getByText('Заморозка: зрители не видят счёт')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закончить раунд сейчас' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Экран зала' })).toHaveAttribute(
      'href',
      generatePath(routePaths.screen, { battleId: '1' }),
    );
    expect(within(screen.getByTestId('match-11')).getByText('7')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Снять фото' })).toHaveLength(4);
  });

  it('removes a photo from an active duel after confirmation', async () => {
    let removed = false;
    mockFetch({
      [battleKey]: () => json(makeAdminBattle()),
      [`POST ${apiUrl('adminRemovePhoto', { battleId: 1, photoId: 2 })}`]: () => {
        removed = true;
        return json(makeAdminBattle());
      },
    });
    renderPage();
    const match = await screen.findByTestId('match-11');
    await userEvent.click(within(match).getAllByRole('button', { name: 'Снять фото' })[1]!);
    const dialog = screen.getByRole('dialog', { name: 'Снять фото?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Снять фото' }));
    expect(removed).toBe(true);
  });

  it('finishes the round shown on screen by sending its number', async () => {
    const fetchMock = mockFetch({
      [battleKey]: () => json(makeAdminBattle()),
      [`POST ${apiUrl('adminFinishRound', { battleId: 1 })}`]: () => json(makeAdminBattle({ round_state: 'break' })),
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Закончить раунд сейчас' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закончить раунд сейчас' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(call?.[1]?.body).toBe('{"round":1}');
    });
  });

  it('starts the next round from the break without a dialog', async () => {
    let advanced = false;
    mockFetch({
      [battleKey]: () => json(makeAdminBattle({ round_state: 'break' })),
      [`POST ${apiUrl('adminNextRound', { battleId: 1 })}`]: () => {
        advanced = true;
        return json(makeAdminBattle({ current_round: 2 }));
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Следующий раунд' }));
    expect(advanced).toBe(true);
  });

  it('shows the bracket of a finished battle without controls', async () => {
    mockFetch({
      [battleKey]: () => json(makeAdminBattle({ status: 'finished', round_state: null, winner: makePhoto(1) })),
    });
    renderPage();
    expect(await screen.findByText('Сетка')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Остановить батл' })).not.toBeInTheDocument();
  });
});
