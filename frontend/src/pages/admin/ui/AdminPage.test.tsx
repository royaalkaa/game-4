import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeAdminBattle } from '@test/fixtures';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { AdminPage } from './AdminPage';

const meKey = `GET ${apiUrl('adminMe')}`;
const listKey = `GET ${apiUrl('adminBattles')}`;
const summary = {
  id: 3,
  title: 'Весенний батл',
  theme: 'Цветы',
  status: 'draft',
  mode: 'duel',
  photo_count: 5,
  created_at: '2026-11-13T10:00:00Z',
};

function renderAdmin() {
  return renderRoutes(routePaths.admin, [{ path: routePaths.admin, element: <AdminPage /> }]);
}

describe('AdminPage', () => {
  it('shows loading while checking the cookie', () => {
    mockFetch({ [meKey]: () => new Promise<Response>(() => undefined) });
    renderAdmin();
    expect(screen.getByText('Проверяем вход')).toBeInTheDocument();
  });

  it('logs in and then shows the battle list', async () => {
    let loggedIn = false;
    const fetchMock = mockFetch({
      [meKey]: () => (loggedIn ? json({ admin: true }) : apiError(401, 'admin_required', 'Нужен вход')),
      [`POST ${apiUrl('adminLogin')}`]: () => {
        loggedIn = true;
        return json({ ok: true });
      },
      [listKey]: () => json([summary]),
    });
    renderAdmin();
    await userEvent.type(await screen.findByLabelText('Пароль'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Весенний батл')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Весенний батл/ })).toHaveAttribute(
      'href',
      generatePath(routePaths.adminBattle, { battleId: '3' }),
    );
    const login = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(login?.[1]?.body).toBe('{"password":"secret"}');
  });

  it('shows the API message for a wrong password', async () => {
    mockFetch({
      [meKey]: () => apiError(401, 'admin_required', 'Нужен вход'),
      [`POST ${apiUrl('adminLogin')}`]: () => apiError(401, 'bad_password', 'Неверный пароль'),
    });
    renderAdmin();
    await userEvent.type(await screen.findByLabelText('Пароль'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный пароль')).toBeInTheDocument();
  });

  it('shows an empty list', async () => {
    mockFetch({ [meKey]: () => json({ admin: true }), [listKey]: () => json([]) });
    renderAdmin();
    expect(await screen.findByText('Батлов пока нет')).toBeInTheDocument();
  });

  it('shows a list error with the API message', async () => {
    mockFetch({ [meKey]: () => json({ admin: true }), [listKey]: () => apiError(500, 'internal', 'База недоступна') });
    renderAdmin();
    expect(await screen.findByText('База недоступна')).toBeInTheDocument();
  });

  it('creates a battle with durations in seconds and opens it', async () => {
    const fetchMock = mockFetch({
      [meKey]: () => json({ admin: true }),
      [listKey]: () => json([]),
      [`POST ${apiUrl('adminBattles')}`]: () => json(makeAdminBattle({ id: 9, status: 'draft' })),
    });
    renderAdmin();
    await userEvent.type(await screen.findByLabelText('Название'), 'Новый');
    await userEvent.type(screen.getByLabelText('Тема'), 'Море');
    const [roundMinutes, freezeMinutes] = screen.getAllByLabelText('Минуты');
    const [roundSeconds] = screen.getAllByLabelText('Секунды');
    await userEvent.clear(roundMinutes!);
    await userEvent.type(roundMinutes!, '2');
    await userEvent.clear(roundSeconds!);
    await userEvent.type(roundSeconds!, '30');
    await userEvent.clear(freezeMinutes!);
    await userEvent.type(freezeMinutes!, '1');
    await userEvent.click(screen.getByLabelText('Автостарт следующего раунда'));
    await userEvent.click(screen.getByRole('button', { name: 'Создать батл' }));

    expect(await screen.findByTestId('location')).toHaveTextContent(
      generatePath(routePaths.adminBattle, { battleId: '9' }),
    );
    const create = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(create?.[1]?.body as string)).toEqual({
      title: 'Новый',
      theme: 'Море',
      round_seconds: 150,
      freeze_seconds: 60,
      auto_advance: true,
      mode: 'duel',
    });
  });
});
