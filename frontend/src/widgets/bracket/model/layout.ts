import type { Bracket, Match } from '@/shared/api';
import { roundTitle } from '@/entities/battle';

export interface BracketColumn {
  round: number;
  title: string;
  // null marks a slot whose match the server creates only after the previous round closes.
  slots: (Match | null)[];
}

export function layoutBracket(bracket: Bracket, totalRounds: number): BracketColumn[] {
  const byRound = new Map(bracket.rounds.map((entry) => [entry.round, entry.matches]));
  return Array.from({ length: totalRounds }, (_, index) => {
    const round = index + 1;
    const size = 2 ** (totalRounds - round);
    const slots: (Match | null)[] = Array.from({ length: size }, () => null);
    for (const match of byRound.get(round) ?? []) {
      if (match.slot >= 0 && match.slot < size) slots[match.slot] = match;
    }
    return { round, title: roundTitle(round, totalRounds), slots };
  });
}
