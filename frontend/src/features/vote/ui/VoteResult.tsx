import { CircleCheck, EyeOff } from 'lucide-react';
import type { Match, Photo } from '@/shared/api';
import { PhotoFrame } from '@/shared/ui';
import { photoLabel, scorePercents } from '@/entities/match';

interface VoteResultProps {
  match: Match;
}

export function VoteResult({ match }: VoteResultProps) {
  const photos = [match.photo_a, match.photo_b].filter((photo): photo is Photo => photo !== null);
  const visible = match.votes_a !== null && match.votes_b !== null;
  const percents = visible ? scorePercents(match.votes_a ?? 0, match.votes_b ?? 0) : null;

  return (
    <section aria-label="Счёт дуэли" className="flex flex-col items-center gap-4">
      <p className="inline-flex items-center gap-2 text-lg font-semibold">
        <CircleCheck aria-hidden className="text-success" />
        Голос принят
      </p>
      <div className="grid w-full grid-cols-2 gap-4">
        {photos.map((photo, index) => {
          const position = index === 0 ? 1 : 2;
          const votes = index === 0 ? match.votes_a : match.votes_b;
          const percent = percents ? (index === 0 ? percents.a : percents.b) : null;
          const mine = match.my_vote === photo.id;
          return (
            <figure
              key={photo.id}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-2 ${mine ? 'border-primary' : 'border-line'}`}
            >
              <PhotoFrame src={photo.url} alt={photoLabel(photo, position)} className="h-32 w-full" />
              {mine && <figcaption className="text-sm font-medium text-primary">Твой выбор</figcaption>}
              {votes !== null && percent !== null && (
                <p className="text-2xl font-bold tabular-nums">
                  {votes} <span className="text-base font-normal text-muted">({percent}%)</span>
                </p>
              )}
            </figure>
          );
        })}
      </div>
      {!visible && (
        <p className="inline-flex items-center gap-2 text-muted">
          <EyeOff aria-hidden size={18} />
          Счёт скрыт до конца раунда
        </p>
      )}
    </section>
  );
}
