import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { JoinPage } from './JoinPage';

const joinKey = `POST ${apiUrl('join', { battleId: 1 })}`;
const joinPath = generatePath(routePaths.join, { battleId: '1' });

function renderJoin(search: string) {
  return renderRoutes(`${joinPath}${search}`, [{ path: routePaths.join, element: <JoinPage /> }]);
}

describe('JoinPage', () => {
  it('joins with the code and opens the battle', async () => {
    const fetchMock = mockFetch({ [joinKey]: () => json({ ok: true }) });
    renderJoin('?code=Ab12Cd34');
    expect(screen.getByText('Входим в батл')).toBeInTheDocument();
    expect(await screen.findByTestId('location')).toHaveTextContent(
      generatePath(routePaths.battle, { battleId: '1' }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe('{"code":"Ab12Cd34"}');
  });

  it('asks to rescan when the code is outdated', async () => {
    mockFetch({ [joinKey]: () => apiError(400, 'code_invalid', 'Код недействителен') });
    renderJoin('?code=old');
    expect(await screen.findByText('Код устарел. Отсканируй QR на экране зала ещё раз')).toBeInTheDocument();
  });

  it('asks to rescan when the link has no code', () => {
    const fetchMock = mockFetch({});
    renderJoin('');
    expect(screen.getByText('Код устарел. Отсканируй QR на экране зала ещё раз')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains a closed battle with the API message', async () => {
    mockFetch({ [joinKey]: () => apiError(409, 'battle_closed', 'Батл уже завершён') });
    renderJoin('?code=x');
    expect(await screen.findByText('Голосование закрыто')).toBeInTheDocument();
    expect(screen.getByText('Батл уже завершён')).toBeInTheDocument();
  });

  it('shows an unknown battle as empty', async () => {
    mockFetch({ [joinKey]: () => apiError(404, 'not_found', 'Такого батла нет') });
    renderJoin('?code=x');
    expect(await screen.findByText('Батл не найден')).toBeInTheDocument();
  });

  it('retries after a network failure', async () => {
    let calls = 0;
    mockFetch({
      [joinKey]: () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return json({ ok: true });
      },
    });
    renderJoin('?code=x');
    expect(await screen.findByText(/Нет связи с сервером/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByTestId('location')).toHaveTextContent(
      generatePath(routePaths.battle, { battleId: '1' }),
    );
  });
});
