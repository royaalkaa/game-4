import type { Standing } from '@/shared/api';

// The count-up takes about this long whatever the votes are, so the hall neither waits nor blinks.
const REVEAL_TOTAL_MS = 9000;
const MIN_TICK_MS = 70;
const MAX_TICK_MS = 700;

export function maxLikes(entries: Standing[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.likes), 0);
}

export function tickMs(entries: Standing[]): number {
  const top = maxLikes(entries);
  if (top === 0) return MAX_TICK_MS;
  return Math.round(Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, REVEAL_TOTAL_MS / top)));
}

// The last step shows the final result: after the counters stop, only rank 1 stays in.
export function lastStep(entries: Standing[]): number {
  return maxLikes(entries) + 1;
}

export interface RevealCard {
  standing: Standing;
  shown: number;
  out: boolean;
  winner: boolean;
}

// All counters grow together; a counter that stopped while the count goes on drops out.
export function revealAt(entries: Standing[], step: number): RevealCard[] {
  const final = step >= lastStep(entries);
  return entries.map((standing) => ({
    standing,
    shown: Math.min(step, standing.likes),
    out: final ? standing.rank !== 1 : standing.likes < step,
    winner: final && standing.rank === 1,
  }));
}

// Cards keep a stable order during the count, so the leader is not given away by position.
export function revealOrder(entries: Standing[]): Standing[] {
  return [...entries].sort((a, b) => a.photo.id - b.photo.id);
}
