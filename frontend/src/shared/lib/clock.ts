// Offset between server and device clocks, measured when a response arrives.
export function clockOffsetMs(serverTime: string, deviceNowMs: number): number {
  return Date.parse(serverTime) - deviceNowMs;
}

export function remainingMs(endsAt: string, offsetMs: number, deviceNowMs: number): number {
  return Math.max(0, Date.parse(endsAt) - (deviceNowMs + offsetMs));
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}
