import type { BattleStatus } from '@/shared/api';

export function roundTitle(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Финал';
  if (fromEnd === 1) return 'Полуфинал';
  if (fromEnd === 2) return 'Четвертьфинал';
  return `Раунд ${round}`;
}

export const statusLabels: Record<BattleStatus, string> = {
  draft: 'Черновик',
  active: 'Идёт',
  finished: 'Завершён',
  stopped: 'Остановлен',
};
