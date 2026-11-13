import { EyeOff, Trophy } from 'lucide-react';
import type { Match, Photo } from '@/shared/api';
import { PhotoFrame } from '@/shared/ui';
import { decidedByLabels, photoLabel, scorePercents } from '@/entities/match';

interface DuelTileProps {
  match: Match;
  hideScore: boolean;
  compact: boolean;
}

export function DuelTile({ match, hideScore, compact }: DuelTileProps) {
  const photos = [match.photo_a, match.photo_b].filter((photo): photo is Photo => photo !== null);
  const votesA = match.votes_a ?? 0;
  const votesB = match.votes_b ?? 0;
  const showScore = !hideScore && match.votes_a !== null && match.votes_b !== null;
  const percents = scorePercents(votesA, votesB);
  const decided = match.decided_by ? decidedByLabels[match.decided_by] : null;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4" data-testid={`duel-${match.id}`}>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo, index) => {
          const winner = match.winner_id === photo.id;
          return (
            <figure key={photo.id} className="flex flex-col items-center gap-2">
              <PhotoFrame
                src={photo.url}
                alt={photoLabel(photo, index === 0 ? 1 : 2)}
                className={`w-full ${compact ? 'h-48' : 'h-80'} ${winner ? 'outline-4 outline-primary' : ''}`}
              />
              {showScore && (
                <p className="inline-flex items-center gap-2 text-4xl font-bold tabular-nums">
                  {winner && <Trophy aria-label="Победитель" className="text-primary" size={32} />}
                  {index === 0 ? votesA : votesB}
                  <span className="text-2xl font-normal text-muted">{index === 0 ? percents.a : percents.b}%</span>
                </p>
              )}
            </figure>
          );
        })}
      </div>
      {showScore ? (
        <div className="flex h-4 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="bg-primary transition-[width] duration-150" style={{ width: `${percents.a}%` }} />
          <div className="bg-accent transition-[width] duration-150" style={{ width: `${percents.b}%` }} />
        </div>
      ) : (
        <p className="inline-flex items-center justify-center gap-3 text-3xl text-muted">
          <EyeOff aria-hidden size={32} />
          Счёт скрыт
        </p>
      )}
      <p className="text-center text-2xl text-muted">
        Голосов: {match.total_votes}
        {decided && `. ${decided}`}
      </p>
    </article>
  );
}
