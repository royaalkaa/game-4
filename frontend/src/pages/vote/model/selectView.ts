import type { ApiError, Battle, Match } from '@/shared/api';

export type VoteView =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not_found' }
  | { kind: 'not_started' }
  | { kind: 'finished' }
  | { kind: 'stopped' }
  | { kind: 'not_joined' }
  | { kind: 'break' }
  | { kind: 'result'; match: Match }
  | { kind: 'duel'; match: Match }
  | { kind: 'all_voted' };

export interface VoteViewInput {
  battle?: Battle;
  battleError?: ApiError;
  // undefined: the next duel of the current round is not loaded yet.
  nextMatch?: Match | null;
  nextMatchError?: ApiError;
  lastVote: Match | null;
}

export function selectVoteView({ battle, battleError, nextMatch, nextMatchError, lastVote }: VoteViewInput): VoteView {
  if (!battle) {
    if (!battleError) return { kind: 'loading' };
    if (battleError.code === 'not_found') return { kind: 'not_found' };
    return { kind: 'error', message: battleError.message };
  }
  if (battle.status === 'finished') return { kind: 'finished' };
  if (battle.status === 'stopped') return { kind: 'stopped' };
  if (battle.status === 'draft') return { kind: 'not_started' };
  if (!battle.joined || nextMatchError?.code === 'not_joined') return { kind: 'not_joined' };
  if (battle.round_state === 'break') return { kind: 'break' };
  if (lastVote) return { kind: 'result', match: lastVote };
  if (nextMatchError) return { kind: 'error', message: nextMatchError.message };
  if (nextMatch === undefined) return { kind: 'loading' };
  if (nextMatch === null) return { kind: 'all_voted' };
  return { kind: 'duel', match: nextMatch };
}
