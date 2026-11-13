import { describe, expect, it } from 'vitest';
import { makeMatch, makePhoto } from '@test/fixtures';
import { layoutBracket } from './layout';

describe('layoutBracket', () => {
  it('gives every round a column with the expected number of slots', () => {
    const columns = layoutBracket({ rounds: [] }, 3);
    expect(columns.map((column) => column.slots.length)).toEqual([4, 2, 1]);
    expect(columns.map((column) => column.title)).toEqual(['Четвертьфинал', 'Полуфинал', 'Финал']);
  });

  it('places matches by slot and leaves future slots empty', () => {
    const bracket = {
      rounds: [
        {
          round: 1,
          matches: [makeMatch({ id: 4, slot: 1 }), makeMatch({ id: 3, slot: 0 })],
        },
      ],
    };
    const [first, final] = layoutBracket(bracket, 2);
    expect(first?.slots.map((match) => match?.id)).toEqual([3, 4]);
    expect(final?.slots).toEqual([null]);
  });

  it('keeps byes of a 5-photo battle in the first round', () => {
    const bye = (id: number, slot: number) =>
      makeMatch({ id, slot, photo_a: makePhoto(id), photo_b: null, decided_by: 'bye', status: 'finished' });
    const bracket = {
      rounds: [
        {
          round: 1,
          matches: [makeMatch({ id: 1, slot: 0 }), bye(2, 1), bye(3, 2), bye(4, 3)],
        },
      ],
    };
    const [first] = layoutBracket(bracket, 3);
    expect(first?.slots.filter((match) => match?.photo_b === null)).toHaveLength(3);
    expect(first?.title).toBe('Четвертьфинал');
  });

  it('names rounds before the quarterfinal by number', () => {
    const columns = layoutBracket({ rounds: [] }, 4);
    expect(columns[0]?.title).toBe('Раунд 1');
    expect(columns[0]?.slots).toHaveLength(8);
  });
});
