import { formatDuration, remainingMs, useNow } from '@/shared/lib';

interface RoundTimerProps {
  endsAt: string;
  offsetMs: number;
  className?: string;
}

export function RoundTimer({ endsAt, offsetMs, className = '' }: RoundTimerProps) {
  const now = useNow(250);
  return (
    <span role="timer" aria-label="До конца раунда" className={`tabular-nums ${className}`}>
      {formatDuration(remainingMs(endsAt, offsetMs, now))}
    </span>
  );
}
