import type { ReactNode } from 'react';
import { Heart, Trophy, X } from 'lucide-react';
import type { Photo, Standing } from '@/shared/api';

interface StandingsListProps {
  entries: Standing[];
  highlightId?: number | null;
  action?: (photo: Photo) => ReactNode;
}

export function StandingsList({ entries, highlightId = null, action }: StandingsListProps) {
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => {
        const mine = entry.photo.id === highlightId;
        return (
          <li
            key={entry.photo.id}
            className={`flex items-center gap-3 rounded-md border-2 bg-surface p-2 ${mine ? 'border-primary' : 'border-line'}`}
          >
            <span className="w-8 shrink-0 text-center font-display text-lg font-bold tabular-nums">
              {entry.rank === 1 ? <Trophy aria-label="1 место" className="mx-auto text-primary" size={22} /> : entry.rank}
            </span>
            <img src={entry.photo.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
            <span className="line-clamp-2 min-w-0 flex-1 leading-tight font-medium break-words">
              {entry.photo.caption ?? 'Без имени'}
              {mine && <span className="ml-2 text-sm text-primary">это ты</span>}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-danger tabular-nums" aria-label={`Да: ${entry.likes}`}>
              <Heart aria-hidden size={16} fill="currentColor" strokeWidth={0} />
              {entry.likes}
            </span>
            <span className="inline-flex items-center gap-1 text-muted tabular-nums" aria-label={`Нет: ${entry.dislikes}`}>
              <X aria-hidden size={16} />
              {entry.dislikes}
            </span>
            {action?.(entry.photo)}
          </li>
        );
      })}
    </ol>
  );
}
