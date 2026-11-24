import { describe, expect, it } from 'vitest';
import type { Standing } from '@/shared/api';
import { makePhoto } from '@test/fixtures';
import { lastStep, revealAt, revealOrder, tickMs } from './reveal';

function standing(id: number, likes: number, rank: number): Standing {
  return { photo: makePhoto(id, `Гость ${id}`), likes, dislikes: 0, rank };
}

const entries = [standing(3, 5, 1), standing(1, 3, 2), standing(2, 0, 3)];

describe('revealAt', () => {
  it('starts everyone at zero and in the game', () => {
    expect(revealAt(entries, 0).map((card) => [card.shown, card.out])).toEqual([
      [0, false],
      [0, false],
      [0, false],
    ]);
  });

  it('drops a card once the count passes its votes', () => {
    const cards = revealAt(entries, 4);
    expect(cards.map((card) => card.shown)).toEqual([4, 3, 0]);
    expect(cards.map((card) => card.out)).toEqual([false, true, true]);
  });

  it('leaves only the winner at the last step', () => {
    const cards = revealAt(entries, lastStep(entries));
    expect(cards.map((card) => card.winner)).toEqual([true, false, false]);
    expect(cards[0]?.shown).toBe(5);
  });

  it('keeps all tied leaders until the final step', () => {
    const tied = [standing(1, 2, 1), standing(2, 2, 2)];
    expect(revealAt(tied, 2).every((card) => !card.out)).toBe(true);
    expect(revealAt(tied, 3).map((card) => card.out)).toEqual([false, true]);
  });
});

describe('timing and order', () => {
  it('fits the count into a few seconds', () => {
    expect(tickMs([standing(1, 1000, 1)])).toBe(70);
    expect(tickMs([standing(1, 3, 1)])).toBe(700);
    expect(tickMs([standing(1, 0, 1)])).toBe(700);
  });

  it('orders cards by photo, not by result', () => {
    expect(revealOrder(entries).map((entry) => entry.photo.id)).toEqual([1, 2, 3]);
  });
});
