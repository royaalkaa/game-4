import { describe, expect, it } from 'vitest';
import { stampOpacity, swipeDecision } from './gesture';

describe('swipeDecision', () => {
  it('long drag right is yes, left is no', () => {
    expect(swipeDecision(140, 900)).toBe(true);
    expect(swipeDecision(-140, 900)).toBe(false);
  });

  it('short slow drag returns the card', () => {
    expect(swipeDecision(40, 800)).toBeNull();
    expect(swipeDecision(0, 10)).toBeNull();
  });

  it('short fast flick counts', () => {
    expect(swipeDecision(-50, 60)).toBe(false);
  });
});

describe('stampOpacity', () => {
  it('grows with distance and stops at 1', () => {
    expect(stampOpacity(0)).toBe(0);
    expect(stampOpacity(-50)).toBe(0.5);
    expect(stampOpacity(400)).toBe(1);
  });
});
