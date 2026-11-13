import { useState, type ReactNode } from 'react';
import type { Bracket, Match, Photo } from '@/shared/api';
import { MatchCard } from '@/entities/match';
import { layoutBracket } from '../model/layout';

interface BracketViewProps {
  bracket: Bracket;
  totalRounds: number;
  currentRound: number | null;
  photoAction?: (match: Match, photo: Photo) => ReactNode;
}

// Phones get one round per tab; from 768px every round is a column.
export function BracketView({ bracket, totalRounds, currentRound, photoAction }: BracketViewProps) {
  const columns = layoutBracket(bracket, totalRounds);
  const [selected, setSelected] = useState(currentRound ?? 1);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Раунды" className="flex gap-2 overflow-x-auto md:hidden">
        {columns.map((column) => (
          <button
            key={column.round}
            type="button"
            role="tab"
            aria-selected={selected === column.round}
            onClick={() => setSelected(column.round)}
            className={`min-h-11 shrink-0 rounded-lg border-2 px-3 text-sm font-medium transition-colors duration-150 ${
              selected === column.round ? 'border-primary bg-primary text-on-primary' : 'border-line-strong bg-surface'
            }`}
          >
            {column.title}
          </button>
        ))}
      </div>
      <div className="md:flex md:gap-4 md:overflow-x-auto">
        {columns.map((column) => (
          <section
            key={column.round}
            aria-label={column.title}
            className={`${selected === column.round ? 'flex' : 'hidden'} flex-col gap-3 md:flex md:w-64 md:shrink-0`}
          >
            <h3 className="hidden font-semibold md:block">{column.title}</h3>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {column.slots.map((match, slot) =>
                match ? (
                  <MatchCard
                    key={match.id}
                    match={match}
                    photoAction={photoAction ? (photo) => photoAction(match, photo) : undefined}
                  />
                ) : (
                  <p key={`slot-${slot}`} className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
                    Ждёт итогов прошлого раунда
                  </p>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
