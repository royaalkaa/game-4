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
  const active = battle.status === 'active' && battle.current_round !== null;
  return (
    <header className="flex flex-col gap-1">
      <h1 className={large ? 'text-6xl font-bold' : 'text-2xl font-bold'}>{battle.title}</h1>
      {battle.theme && <p className={large ? 'text-3xl text-muted' : 'text-muted'}>Тема: {battle.theme}</p>}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${large ? 'mt-4 text-4xl' : 'mt-1 text-base'}`}>
        {active ? (
          <span className="font-medium">
            Раунд {battle.current_round} из {battle.total_rounds}
          </span>
        ) : (
          <span className="font-medium">{statusLabels[battle.status]}</span>
        )}
        {active && battle.round_state === 'running' && battle.round_ends_at && (
          <span className="inline-flex items-center gap-2 font-semibold">
            <Timer aria-hidden size={large ? 40 : 18} />
            <RoundTimer endsAt={battle.round_ends_at} offsetMs={offsetMs} />
          </span>
        )}
        {active && battle.round_state === 'break' && <span className="text-muted">Перерыв</span>}
      </div>
    </header>
  );
}
