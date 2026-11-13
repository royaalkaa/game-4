import { describe, expect, it } from 'vitest';
import { clockOffsetMs, formatDuration, remainingMs } from './clock';

const SERVER_NOW = Date.parse('2026-11-13T18:00:00Z');

describe('clockOffsetMs', () => {
  it('is positive when the device clock is behind the server', () => {
    expect(clockOffsetMs('2026-11-13T18:00:00Z', SERVER_NOW - 90_000)).toBe(90_000);
  });

  it('is negative when the device clock is ahead of the server', () => {
    expect(clockOffsetMs('2026-11-13T18:00:00Z', SERVER_NOW + 5_000)).toBe(-5_000);
  });
});

describe('remainingMs', () => {
  const endsAt = '2026-11-13T18:02:00Z';

  it('counts from server time, not from the raw device clock', () => {
    const deviceNow = SERVER_NOW - 3_600_000;
    const offset = clockOffsetMs('2026-11-13T18:00:00Z', deviceNow);
    expect(remainingMs(endsAt, offset, deviceNow)).toBe(120_000);
    expect(remainingMs(endsAt, offset, deviceNow + 30_000)).toBe(90_000);
  });

  it('gives the same result for devices with different clock errors', () => {
    const fast = SERVER_NOW + 42_000;
    const slow = SERVER_NOW - 17_000;
    expect(remainingMs(endsAt, clockOffsetMs('2026-11-13T18:00:00Z', fast), fast)).toBe(
      remainingMs(endsAt, clockOffsetMs('2026-11-13T18:00:00Z', slow), slow),
    );
  });

  it('never goes below zero', () => {
    expect(remainingMs(endsAt, 0, SERVER_NOW + 600_000)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds, rounding partial seconds up', () => {
    expect(formatDuration(120_000)).toBe('2:00');
    expect(formatDuration(59_001)).toBe('1:00');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('adds hours for long rounds', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});
