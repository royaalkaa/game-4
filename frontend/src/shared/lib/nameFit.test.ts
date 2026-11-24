import { describe, expect, it } from 'vitest';
import { nameFit } from './nameFit';

describe('nameFit', () => {
  it('keeps short names big and shrinks long full names', () => {
    expect(nameFit('Глеб')).toBe('short');
    expect(nameFit('Петров Борис Игоревич')).toBe('medium');
    expect(nameFit('Константинопольская Александра Викторовна')).toBe('long');
  });
});
