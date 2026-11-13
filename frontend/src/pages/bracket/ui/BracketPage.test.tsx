import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeBattle, makeMatch, makePhoto } from '@test/fixtures';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { BracketPage } from './BracketPage';

const battleKey = `GET ${apiUrl('battle', { battleId: 1 })}`;
const bracketKey = `GET ${apiUrl('bracket', { battleId: 1 })}`;

function renderBracket() {
  return renderRoutes(generatePath(routePaths.bracket, { battleId: '1' }), [
    { path: routePaths.bracket, element: <BracketPage /> },
  ]);
}

describe('BracketPage', () => {
  it('shows loading first', () => {
    mockFetch({
      [battleKey]: () => new Promise<Response>(() => undefined),
      [bracketKey]: () => new Promise<Response>(() => undefined),
    });
    renderBracket();
    expect(screen.getByText('Загружаем сетку')).toBeInTheDocument();
  });

  it('shows the API message on error', async () => {
    mockFetch({ [battleKey]: () => json(makeBattle()), [bracketKey]: () => apiError(500, 'internal', 'Сбой сетки') });
    renderBracket();
    expect(await screen.findByText('Сбой сетки')).toBeInTheDocument();
  });

  it('shows not found as empty', async () => {
    mockFetch({ [battleKey]: () => apiError(404, 'not_found', 'Нет'), [bracketKey]: () => json({ rounds: [] }) });
    renderBracket();
    expect(await screen.findByText('Батл не найден')).toBeInTheDocument();
  });

  it('shows an empty bracket', async () => {
    mockFetch({ [battleKey]: () => json(makeBattle()), [bracketKey]: () => json({ rounds: [] }) });
    renderBracket();
    expect(await screen.findByText('Сетка появится после запуска батла')).toBeInTheDocument();
  });

  it('shows rounds as tabs with the current round selected', async () => {
    const final = makeMatch({ id: 30, round: 2, photo_a: makePhoto(1, 'Анна'), photo_b: makePhoto(3, 'Вера') });
    mockFetch({
      [battleKey]: () => json(makeBattle({ current_round: 2 })),
      [bracketKey]: () =>
        json({
          rounds: [
            {
              round: 1,
              matches: [
                makeMatch({ id: 10, status: 'finished', winner_id: 1, decided_by: 'votes', votes_a: 5, votes_b: 2 }),
                makeMatch({ id: 11, slot: 1, photo_a: makePhoto(3), photo_b: null, decided_by: 'bye', winner_id: 3 }),
              ],
            },
            { round: 2, matches: [final] },
          ],
        }),
    });
    renderBracket();
    const finalTab = await screen.findByRole('tab', { name: 'Финал' });
    expect(finalTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Проголосовало: 0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Полуфинал' }));
    expect(screen.getByRole('tab', { name: 'Полуфинал' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Проход без дуэли')).toBeInTheDocument();
  });
});
