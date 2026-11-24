import { Flame, Timer } from 'lucide-react';
import type { Battle } from '@/shared/api';
import { RoundTimer, statusLabels } from '@/entities/battle';

interface SwipeTopBarProps {
  battle: Battle;
  offsetMs: number;
}

// A compact app bar instead of the poster header: the photo card is the hero of the screen.
export function SwipeTopBar({ battle, offsetMs }: SwipeTopBarProps) {
  const voting = battle.status === 'active' && battle.phase === 'voting';
  const label =
    battle.status !== 'active' ? statusLabels[battle.status] : battle.phase === 'collecting' ? 'Приём фото' : 'Голосование';
  return (
    <header className="flex items-center gap-3">
      <span className="bg-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#fff]">
        <Flame aria-hidden size={22} fill="currentColor" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg leading-tight">{battle.title}</h1>
        {battle.theme && <p className="truncate text-sm text-muted">{battle.theme}</p>}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">
        {voting && battle.round_ends_at ? (
          <>
            <Timer aria-hidden size={15} />
            <RoundTimer endsAt={battle.round_ends_at} offsetMs={offsetMs} />
          </>
        ) : (
          label
        )}
      </span>
    </header>
  );
}
