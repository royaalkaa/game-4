import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generatePath } from 'react-router';
import { describe, expect, it } from 'vitest';
import { apiUrl } from '@/shared/api';
import { routePaths } from '@/shared/config';
import { makeBattle, makePhoto } from '@test/fixtures';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { renderRoutes } from '@test/render';
import { VotePage } from './VotePage';

const battleUrl = `GET ${apiUrl('battle', { battleId: 1 })}`;
const deckUrl = `GET ${apiUrl('deck', { battleId: 1 })}`;
const standingsUrl = `GET ${apiUrl('standings', { battleId: 1 })}`;
const swipeUrl = (photoId: number) => `POST ${apiUrl('swipe', { photoId })}`;

const swipeBattle = (overrides = {}) =>
  makeBattle({ mode: 'swipe', phase: 'voting', total_rounds: 1, ...overrides });

function renderVote() {
  return renderRoutes(generatePath(routePaths.battle, { battleId: '1' }), [{ path: routePaths.battle, element: <VotePage /> }]);
}

describe('SwipeVote', () => {
  it('asks for a photo and a name while photos are collected', async () => {
    mockFetch({ [battleUrl]: () => json(swipeBattle({ phase: 'collecting', round_state: null })) });
    renderVote();
    expect(await screen.findByText('Загрузи фото и имя')).toBeInTheDocument();
    expect(screen.getByText('Приём фото')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Участвовать' })).toBeDisabled();
  });

  it('shows the own entry after upload', async () => {
    mockFetch({
      [battleUrl]: () =>
        json(swipeBattle({ phase: 'collecting', round_state: null, my_photo: makePhoto(7, 'Анна'), participants: 3 })),
    });
    renderVote();
    expect(await screen.findByText('Ты в игре')).toBeInTheDocument();
    expect(screen.getByText('Анна')).toBeInTheDocument();
    expect(screen.getByText(/Участников: 3/)).toBeInTheDocument();
  });

  it('swipes with buttons and finishes the deck', async () => {
    const fetchMock = mockFetch({
      [battleUrl]: () => json(swipeBattle()),
      [deckUrl]: () => json({ photos: [makePhoto(2, 'Борис'), makePhoto(3, 'Вера')], total: 2 }),
      [swipeUrl(2)]: () => json({ ok: true }),
      [swipeUrl(3)]: () => json({ ok: true }),
    });
    renderVote();

    expect(await screen.findByText('Борис')).toBeInTheDocument();
    expect(screen.getByText('1 из 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Да: Борис' }));
    expect(await screen.findByText('Вера')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Нет: Вера' }));

    expect(await screen.findByText('Готово, ты оценил всех!')).toBeInTheDocument();
    const bodies = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([url, init]) => [url, JSON.parse(init?.body as string) as unknown]);
    expect(bodies).toEqual([
      [apiUrl('swipe', { photoId: 2 }), { liked: true }],
      [apiUrl('swipe', { photoId: 3 }), { liked: false }],
    ]);
  });

  it('swipes right by dragging the card', async () => {
    const fetchMock = mockFetch({
      [battleUrl]: () => json(swipeBattle()),
      [deckUrl]: () => json({ photos: [makePhoto(2, 'Борис')], total: 1 }),
      [swipeUrl(2)]: () => json({ ok: true }),
    });
    renderVote();
    const card = await screen.findByTestId('swipe-card');
    card.setPointerCapture = () => undefined;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 300, clientY: 110, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 300, clientY: 110, pointerId: 1 });

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ liked: true });
  });

  it('keeps the card and shows the error when the vote is not sent', async () => {
    mockFetch({
      [battleUrl]: () => json(swipeBattle()),
      [deckUrl]: () => json({ photos: [makePhoto(2, 'Борис')], total: 1 }),
      [swipeUrl(2)]: () => apiError(500, 'internal', 'Сервер устал'),
    });
    renderVote();
    await userEvent.click(await screen.findByRole('button', { name: 'Да: Борис' }));
    expect(await screen.findByText('Голос не отправлен. Сервер устал')).toBeInTheDocument();
    expect(screen.getByText('Борис')).toBeInTheDocument();
  });

  it('shows the place and the count-up after the vote', { timeout: 10000 }, async () => {
    mockFetch({
      [battleUrl]: () =>
        json(swipeBattle({ status: 'finished', phase: null, round_state: null, my_photo: makePhoto(3, 'Вера') })),
      [standingsUrl]: () =>
        json({
          entries: [
            { photo: makePhoto(2, 'Борис'), likes: 4, dislikes: 0, rank: 1 },
            { photo: makePhoto(3, 'Вера'), likes: 1, dislikes: 3, rank: 2 },
          ],
        }),
    });
    renderVote();
    expect(await screen.findByText('Считаем голоса…')).toBeInTheDocument();
    // The place would give the result away, so it appears only after the count.
    expect(screen.queryByText(/Твоё место/)).not.toBeInTheDocument();
    expect(await screen.findByText('Твоё место: 2 из 2', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.getByText('Победитель!')).toBeInTheDocument();
  });

  it('asks to scan the QR before joining', async () => {
    mockFetch({ [battleUrl]: () => json(swipeBattle({ joined: false })) });
    renderVote();
    expect(await screen.findByText(/чтобы участвовать/)).toBeInTheDocument();
  });
});
