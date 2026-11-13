import { useState } from 'react';
import { asApiError, type Match, type Photo } from '@/shared/api';
import { Button, PhotoFrame } from '@/shared/ui';
import { photoLabel } from '@/entities/match';
import { castVote } from '../api/voteApi';

// These codes mean the shown duel is no longer votable; the page loads the next one.
const STALE_CODES = new Set(['already_voted', 'match_closed', 'not_joined']);

interface DuelVoteProps {
  match: Match;
  onVoted: (result: Match) => void;
  onStale: (code: string) => void;
}

export function DuelVote({ match, onVoted, onStale }: DuelVoteProps) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photos = [match.photo_a, match.photo_b].filter((photo): photo is Photo => photo !== null);

  const choose = async (photo: Photo) => {
    setPendingId(photo.id);
    setError(null);
    try {
      onVoted(await castVote(match.id, photo.id));
    } catch (caught) {
      const apiError = asApiError(caught);
      if (STALE_CODES.has(apiError.code)) {
        onStale(apiError.code);
        return;
      }
      setError(apiError.message);
      setPendingId(null);
    }
  };

  return (
    <section aria-label="Дуэль" className="flex flex-col gap-4">
      <p className="text-sm text-muted">Проголосовало: {match.total_votes}</p>
      {/* Both photos and both buttons fit on one phone screen without scrolling. */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {photos.map((photo, index) => {
          const label = photoLabel(photo, index === 0 ? 1 : 2);
          return (
            <figure key={photo.id} className="flex flex-col gap-2 md:gap-3">
              <PhotoFrame src={photo.url} alt={label} className="h-[26svh] w-full md:h-[60vh]" />
              {photo.caption && <figcaption className="text-center">{photo.caption}</figcaption>}
              <Button
                variant="primary"
                size="lg"
                aria-label={`Выбрать: ${label}`}
                disabled={pendingId !== null}
                onClick={() => void choose(photo)}
              >
                Выбрать
              </Button>
            </figure>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
