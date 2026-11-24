import type { AdminBattle, Battle, Match, Photo } from '@/shared/api';

export const SERVER_TIME = '2026-11-13T18:00:00Z';

export function makePhoto(id: number, caption: string | null = null): Photo {
  return { id, url: `/media/photo-${id}.jpg`, caption, width: 1200, height: 800 };
}

export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 1,
    round: 1,
    slot: 0,
    status: 'active',
    photo_a: makePhoto(1),
    photo_b: makePhoto(2),
    ends_at: '2026-11-13T18:02:00Z',
    winner_id: null,
    decided_by: null,
    total_votes: 0,
    votes_a: null,
    votes_b: null,
    my_vote: null,
    ...overrides,
  };
}

export function makeBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: 1,
    title: 'Осенний батл',
    theme: 'Город ночью',
    mode: 'duel',
    phase: null,
    status: 'active',
    round_state: 'running',
    current_round: 1,
    total_rounds: 2,
    round_ends_at: '2026-11-13T18:02:00Z',
    frozen: false,
    winner: null,
    joined: true,
    my_photo: null,
    participants: 4,
    server_time: SERVER_TIME,
    ...overrides,
  };
}

export function makeAdminBattle(overrides: Partial<AdminBattle> = {}): AdminBattle {
  return {
    ...makeBattle(),
    joined: false,
    round_seconds: 120,
    freeze_seconds: 30,
    auto_advance: false,
    photos: [makePhoto(1, 'Анна'), makePhoto(2, 'Борис'), makePhoto(3, 'Вера'), makePhoto(4, 'Глеб')],
    bracket: {
      rounds: [
        {
          round: 1,
          matches: [
            makeMatch({ id: 11, slot: 0, photo_a: makePhoto(1, 'Анна'), photo_b: makePhoto(2, 'Борис'), total_votes: 10, votes_a: 7, votes_b: 3 }),
            makeMatch({ id: 12, slot: 1, photo_a: makePhoto(3, 'Вера'), photo_b: makePhoto(4, 'Глеб'), total_votes: 4, votes_a: 1, votes_b: 3 }),
          ],
        },
      ],
    },
    voters: 42,
    swipers: 0,
    standings: [],
    ...overrides,
  };
}
