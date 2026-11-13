import type { DecidedBy, Photo } from '@/shared/api';

// Rounds so that the two shares always add up to 100.
export function scorePercents(votesA: number, votesB: number): { a: number; b: number } {
  const total = votesA + votesB;
  if (total === 0) return { a: 0, b: 0 };
  const a = Math.round((votesA * 100) / total);
  return { a, b: 100 - a };
}

export const decidedByLabels: Record<DecidedBy, string | null> = {
  votes: null,
  tie: 'Ничья: прошло фото, первым набравшее голоса',
  lot: 'По жребию',
  removal: 'Фото снято',
  bye: 'Проход без дуэли',
};

export function photoLabel(photo: Photo, position: 1 | 2): string {
  return photo.caption ?? `Фото ${position}`;
}
