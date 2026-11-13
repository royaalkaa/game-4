import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeBattle, makeMatch, makePhoto } from '@test/fixtures';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { ResultsPage } from './ResultsPage';

const battleKey = `GET ${apiUrl('battle', { battleId: 1 })}`;
const bracketKey = `GET ${apiUrl('bracket', { battleId: 1 })}`;
const resultsPath = generatePath(routePaths.results, { battleId: '1' });

const anna = makePhoto(1, 'Анна');
const boris = makePhoto(2, 'Борис');
const vera = makePhoto(3, 'Вера');
const gleb = makePhoto(4, 'Глеб');
const finished = { status: 'finished' as const, decided_by: 'votes' as const };
const bracket = {
  rounds: [
    {
      round: 1,
      matches: [
        makeMatch({ id: 1, ...finished, photo_a: anna, photo_b: boris, winner_id: 1, votes_a: 6, votes_b: 2 }),
        makeMatch({ id: 2, slot: 1, ...finished, photo_a: vera, photo_b: gleb, winner_id: 3, votes_a: 4, votes_b: 1 }),
      ],
    },
    {
      round: 2,
      matches: [makeMatch({ id: 3, round: 2, ...finished, photo_a: anna, photo_b: vera, winner_id: 1, votes_a: 9, votes_b: 8 })],
    },
  ],
};

function renderResults() {
  return renderRoutes(resultsPath, [{ path: routePaths.results, element: <ResultsPage /> }]);
}

describe('ResultsPage', () => {
  it('shows loading first', () => {
    mockFetch({
      [battleKey]: () => new Promise<Response>(() => undefined),
      [bracketKey]: () => new Promise<Response>(() => undefined),
    });
    renderResults();
    expect(screen.getByText('Загружаем итоги')).toBeInTheDocument();
  });

  it('shows the API message on error', async () => {
    mockFetch({ [battleKey]: () => apiError(500, 'internal', 'Итоги недоступны'), [bracketKey]: () => json(bracket) });
    renderResults();
    expect(await screen.findByText('Итоги недоступны')).toBeInTheDocument();
  });

  it('says results come after the final while the battle runs', async () => {
    mockFetch({ [battleKey]: () => json(makeBattle()), [bracketKey]: () => json(bracket) });
    renderResults();
    expect(await screen.findByText('Итоги появятся после финала')).toBeInTheDocument();
  });

  it('shows the winner, the path through the bracket and shares the link', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    mockFetch({
      [battleKey]: () => json(makeBattle({ status: 'finished', round_state: null, winner: anna })),
      [bracketKey]: () => json(bracket),
    });
    renderResults();

    const path = await screen.findByRole('region', { name: 'Путь победителя' });
    expect(within(path).getAllByRole('listitem')).toHaveLength(2);
    expect(within(path).getByText('Полуфинал')).toBeInTheDocument();
    expect(within(path).getByText('Финал')).toBeInTheDocument();
    expect(within(path).getByText('9')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Поделиться ссылкой' }));
    expect(writeText).toHaveBeenCalledWith(window.location.origin + resultsPath);
    expect(await screen.findByText('Ссылка скопирована')).toBeInTheDocument();
  });
});
