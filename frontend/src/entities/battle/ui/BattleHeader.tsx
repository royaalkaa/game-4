import { Timer } from 'lucide-react';
import type { Battle } from '@/shared/api';
import { statusLabels } from '../lib/labels';
import { RoundTimer } from './RoundTimer';

interface BattleHeaderProps {
  battle: Battle;
  offsetMs: number;
  large?: boolean;
}

export function BattleHeader({ battle, offsetMs, large = false }: BattleHeaderProps) {
  const swipe = battle.mode === 'swipe';
  const active = battle.status === 'active' && battle.current_round !== null;
  const pill = swipe
    ? battle.phase === 'collecting'
      ? 'Приём фото'
      : 'Голосование'
    : `Раунд ${battle.current_round} из ${battle.total_rounds}`;
  const showPill = battle.status === 'active' && (swipe ? battle.phase !== null : active);
  return (
    <header className="flex flex-col gap-1">
      <h1 className={large ? 'text-6xl font-bold leading-tight' : 'text-2xl font-bold leading-tight'}>{battle.title}</h1>
      {battle.theme && <p className={large ? 'text-3xl text-muted' : 'text-muted'}>Тема: {battle.theme}</p>}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${large ? 'mt-4 text-4xl' : 'mt-1 text-base'}`}>
        {showPill ? (
          <span className="rounded-md border-2 border-line-strong bg-primary px-2 py-0.5 font-semibold text-on-primary">
            {pill}
          </span>
        ) : (
          <span className="font-medium">{statusLabels[battle.status]}</span>
        )}
        {active && battle.round_state === 'running' && battle.round_ends_at && (
          <span className="inline-flex items-center gap-2 font-display font-semibold tabular-nums">
            <Timer aria-hidden size={large ? 40 : 18} />
            <RoundTimer endsAt={battle.round_ends_at} offsetMs={offsetMs} />
          </span>
        )}
        {active && battle.round_state === 'break' && <span className="text-muted">Перерыв</span>}
      </div>
    </header>
  );
}
