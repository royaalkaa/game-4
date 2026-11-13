import type { ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import type { Match, Photo } from '@/shared/api';
import { PhotoFrame } from '@/shared/ui';
import { decidedByLabels, photoLabel } from '../lib/score';

interface MatchCardProps {
  match: Match;
  photoAction?: (photo: Photo) => ReactNode;
}

export function MatchCard({ match, photoAction }: MatchCardProps) {
  const sides = [
    { photo: match.photo_a, votes: match.votes_a, position: 1 as const },
    { photo: match.photo_b, votes: match.votes_b, position: 2 as const },
  ];
  const scoreHidden = match.votes_a === null && match.photo_b !== null && match.status !== 'pending';
  // A bye already says so in place of the missing photo.
  const decided = match.decided_by && match.decided_by !== 'bye' ? decidedByLabels[match.decided_by] : null;

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3" data-testid={`match-${match.id}`}>
      {sides.map(({ photo, votes, position }) => {
        if (!photo) {
          return (
            <p key={position} className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
              {match.photo_a ? 'Проход без дуэли' : 'Ожидает'}
            </p>
          );
        }
        const label = photoLabel(photo, position);
        const winner = match.winner_id === photo.id;
        return (
          <div key={position} className={`flex items-center gap-3 rounded-lg p-1 ${winner ? 'bg-primary-soft' : ''}`}>
            <PhotoFrame src={photo.url} alt={label} className="h-16 w-16 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <p className="w-full truncate text-sm">{label}</p>
              {photoAction?.(photo)}
            </div>
            {votes !== null && match.decided_by !== 'bye' && <span className="text-lg font-semibold tabular-nums">{votes}</span>}
            {winner && <Trophy aria-label="Победитель" size={18} className="shrink-0 text-primary" />}
          </div>
        );
      })}
      {(scoreHidden || decided) && (
        <p className="text-xs text-muted">
          {scoreHidden && `Проголосовало: ${match.total_votes}`}
          {scoreHidden && decided && '. '}
          {decided}
        </p>
      )}
    </article>
  );
}
