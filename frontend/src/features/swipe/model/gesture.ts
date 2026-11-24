// A card counts as swiped after a long drag or a short fast flick, like in dating apps.
export const SWIPE_DISTANCE_PX = 100;
const FLICK_MIN_PX = 30;
const FLICK_SPEED_PX_PER_MS = 0.5;

// true: swiped right (yes), false: swiped left (no), null: not far enough, the card returns.
export function swipeDecision(dx: number, durationMs: number): boolean | null {
  const distance = Math.abs(dx);
  const fast = distance >= FLICK_MIN_PX && distance / Math.max(durationMs, 1) >= FLICK_SPEED_PX_PER_MS;
  if (distance >= SWIPE_DISTANCE_PX || fast) return dx > 0;
  return null;
}

// How strongly the yes/no stamp shows while dragging, from 0 to 1.
export function stampOpacity(dx: number): number {
  return Math.min(Math.abs(dx) / SWIPE_DISTANCE_PX, 1);
}
