import { screen, within } from '@testing-library/react';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeAdminBattle, makePhoto } from '@test/fixtures';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { ScreenPage } from './ScreenPage';

const battleKey = `GET ${apiUrl('adminBattle', { battleId: 1 })}`;

function renderScreen() {
  return renderRoutes(generatePath(routePaths.screen, { battleId: '1' }), [
    { path: routePaths.screen, element: <ScreenPage /> },
  ]);
}

describe('ScreenPage', () => {
  it('shows loading first', () => {
    mockFetch({ [battleKey]: () => new Promise<Response>(() => undefined) });
    renderScreen();
    expect(screen.getByText('Загрузка')).toBeInTheDocument();
  });

  it('shows no rights with a login link without the admin cookie', async () => {
    mockFetch({ [battleKey]: () => apiError(401, 'admin_required', 'Нужен вход') });
    renderScreen();
    expect(await screen.findByText('Экран зала только для ведущего')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', routePaths.admin);
  });

  it('shows the API message on error', async () => {
    mockFetch({ [battleKey]: () => apiError(503, 'unavailable', 'Сервер недоступен') });
    renderScreen();
    expect(await screen.findByText('Сервер недоступен')).toBeInTheDocument();
  });

  it('shows an empty state for a draft', async () => {
    mockFetch({ [battleKey]: () => json(makeAdminBattle({ status: 'draft', round_state: null, current_round: null })) });
    renderScreen();
    expect(await screen.findByText('Батл ещё не запущен')).toBeInTheDocument();
  });

  it('shows the QR, header and live scores with shares', async () => {
    mockFetch({ [battleKey]: () => json(makeAdminBattle()) });
    renderScreen();
    const qr = await screen.findByRole('img', { name: 'QR-код для входа в голосование' });
    expect(qr.getAttribute('src')).toMatch(new RegExp(`^${apiUrl('adminQr', { battleId: 1 })}\\?t=\\d+$`));
    expect(screen.getByText('Раунд 1 из 2')).toBeInTheDocument();
    expect(screen.getByText('Зрителей: 42')).toBeInTheDocument();
    const duel = screen.getByTestId('duel-11');
    expect(within(duel).getByText('70%')).toBeInTheDocument();
    expect(within(duel).getByText('30%')).toBeInTheDocument();
  });

  it('hides the score during the freeze even though the admin API returns it', async () => {
    mockFetch({ [battleKey]: () => json(makeAdminBattle({ frozen: true })) });
    renderScreen();
    expect(await screen.findByText('Счёт скрыт до конца раунда')).toBeInTheDocument();
    expect(screen.getAllByText('Счёт скрыт')).toHaveLength(2);
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
  });

  it('shows round results during the break', async () => {
    mockFetch({ [battleKey]: () => json(makeAdminBattle({ round_state: 'break' })) });
    renderScreen();
    expect(await screen.findByText('Раунд окончен. Результаты')).toBeInTheDocument();
  });

  it('shows the winner photo on the whole screen after the final', async () => {
    mockFetch({
      [battleKey]: () =>
        json(makeAdminBattle({ status: 'finished', round_state: null, winner: makePhoto(3, 'Вера') })),
    });
    renderScreen();
    expect(await screen.findByText('Победитель: Вера')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Вера' })).toHaveAttribute('src', makePhoto(3).url);
  });
});
