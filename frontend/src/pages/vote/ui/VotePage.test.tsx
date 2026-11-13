import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeBattle, makeMatch, makePhoto } from '@test/fixtures';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { VotePage } from './VotePage';

const battleUrl = `GET ${apiUrl('battle', { battleId: 1 })}`;
const nextUrl = `GET ${apiUrl('nextMatch', { battleId: 1 })}`;
const bracketUrl = `GET ${apiUrl('bracket', { battleId: 1 })}`;

function renderVote() {
  return renderRoutes(generatePath(routePaths.battle, { battleId: '1' }), [{ path: routePaths.battle, element: <VotePage /> }]);
}

describe('VotePage', () => {
  it('shows loading first', () => {
    mockFetch({ [battleUrl]: () => new Promise<Response>(() => undefined) });
    renderVote();
    expect(screen.getByText('Загружаем батл')).toBeInTheDocument();
  });

  it('shows an empty state for an unknown battle', async () => {
    mockFetch({ [battleUrl]: () => apiError(404, 'not_found', 'Батл не найден') });
    renderVote();
    expect(await screen.findByText('Батл не найден')).toBeInTheDocument();
  });

  it('shows the API message on error', async () => {
    mockFetch({ [battleUrl]: () => apiError(500, 'internal', 'Сервер перегружен, попробуй позже') });
    renderVote();
    expect(await screen.findByText('Сервер перегружен, попробуй позже')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('asks to scan the QR when the viewer has not joined', async () => {
    mockFetch({ [battleUrl]: () => json(makeBattle({ joined: false })) });
    renderVote();
    expect(await screen.findByText('Нет доступа к голосованию')).toBeInTheDocument();
    expect(screen.getByText(/Отсканируй QR/)).toBeInTheDocument();
  });

  it('shows the header with a timer counted from server time', async () => {
    mockFetch({ [battleUrl]: () => json(makeBattle()), [nextUrl]: () => json({ match: null }) });
    renderVote();
    expect(await screen.findByText('Осенний батл')).toBeInTheDocument();
    expect(screen.getByText('Тема: Город ночью')).toBeInTheDocument();
    expect(screen.getByText('Раунд 1 из 2')).toBeInTheDocument();
    expect(screen.getByRole('timer').textContent).toMatch(/^(2:00|1:59)$/);
  });

  it('votes, shows the duel score and moves on to the next duel', async () => {
    const first = makeMatch({ id: 5, total_votes: 3 });
    const second = makeMatch({ id: 6, slot: 1, photo_a: makePhoto(3), photo_b: makePhoto(4) });
    let nextCalls = 0;
    const fetchMock = mockFetch({
      [battleUrl]: () => json(makeBattle()),
      [nextUrl]: () => json({ match: nextCalls++ === 0 ? first : second }),
      [`POST ${apiUrl('vote', { matchId: 5 })}`]: () =>
        json({ ...first, my_vote: 1, total_votes: 4, votes_a: 3, votes_b: 1 }),
    });
    renderVote();

    expect(await screen.findByText('Проголосовало: 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Выбрать: Фото 1' }));

    const result = await screen.findByRole('region', { name: 'Счёт дуэли' });
    expect(within(result).getByText('Твой выбор')).toBeInTheDocument();
    expect(within(result).getByText('(75%)')).toBeInTheDocument();
    expect(within(result).getByText('(25%)')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('img', { name: 'Фото 1' })).toHaveAttribute('src', makePhoto(3).url), {
      timeout: 3000,
    });
    const voteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(voteCall?.[1]?.body).toBe('{"photo_id":1}');
  });

  it('hides the score after a vote during the freeze', async () => {
    const match = makeMatch({ id: 5 });
    mockFetch({
      [battleUrl]: () => json(makeBattle({ frozen: true })),
      [nextUrl]: () => json({ match }),
      [`POST ${apiUrl('vote', { matchId: 5 })}`]: () => json({ ...match, my_vote: 2, total_votes: 9 }),
    });
    renderVote();
    await userEvent.click(await screen.findByRole('button', { name: 'Выбрать: Фото 2' }));
    expect(await screen.findByText('Счёт скрыт до конца раунда')).toBeInTheDocument();
  });

  it('shows the API message when a vote fails for another reason', async () => {
    const match = makeMatch({ id: 5 });
    mockFetch({
      [battleUrl]: () => json(makeBattle()),
      [nextUrl]: () => json({ match }),
      [`POST ${apiUrl('vote', { matchId: 5 })}`]: () => apiError(400, 'bad_photo', 'Этого фото нет в дуэли'),
    });
    renderVote();
    await userEvent.click(await screen.findByRole('button', { name: 'Выбрать: Фото 1' }));
    expect(await screen.findByText('Этого фото нет в дуэли')).toBeInTheDocument();
  });

  it('says all duels are voted and links to the bracket', async () => {
    mockFetch({ [battleUrl]: () => json(makeBattle()), [nextUrl]: () => json({ match: null }) });
    renderVote();
    expect(await screen.findByText('Ты проголосовал во всех дуэлях раунда')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Смотреть сетку' })).toHaveAttribute('href', generatePath(routePaths.bracket, { battleId: '1' }));
  });

  it('shows round results during the break', async () => {
    const finished = makeMatch({
      id: 7,
      status: 'finished',
      photo_a: makePhoto(1, 'Анна'),
      photo_b: makePhoto(2, 'Борис'),
      winner_id: 1,
      decided_by: 'lot',
      votes_a: 0,
      votes_b: 0,
    });
    mockFetch({
      [battleUrl]: () => json(makeBattle({ round_state: 'break' })),
      [bracketUrl]: () => json({ rounds: [{ round: 1, matches: [finished] }] }),
    });
    renderVote();
    expect(await screen.findByText('Раунд окончен, ждём ведущего')).toBeInTheDocument();
    expect(await screen.findByText('Анна')).toBeInTheDocument();
    expect(screen.getByText('По жребию')).toBeInTheDocument();
  });

  it('shows the winner after the final', async () => {
    mockFetch({
      [battleUrl]: () =>
        json(makeBattle({ status: 'finished', round_state: null, winner: makePhoto(4, 'Глеб'), joined: false })),
    });
    renderVote();
    expect(await screen.findByText('Победитель')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Глеб' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Итоги батла' })).toHaveAttribute('href', generatePath(routePaths.results, { battleId: '1' }));
  });
});
