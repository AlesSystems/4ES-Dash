import { describe, it, expect } from 'vitest';
import { utcDayKey, clampPlaytime } from '@/server/jobs/snapshot';

describe('utcDayKey', () => {
  it('truncates a timestamp to UTC midnight', () => {
    const key = utcDayKey(new Date('2026-06-16T18:30:45.123Z'));
    expect(key.toISOString()).toBe('2026-06-16T00:00:00.000Z');
  });

  it('uses the UTC calendar day, not local time', () => {
    // 23:30 UTC is still the 16th in UTC even if local time has rolled over.
    const key = utcDayKey(new Date('2026-06-16T23:30:00.000Z'));
    expect(key.getUTCHours()).toBe(0);
    expect(key.getUTCDate()).toBe(16);
  });
});

describe('clampPlaytime (monotonic)', () => {
  it('keeps the reported value when it is greater than the previous', () => {
    expect(clampPlaytime(100, 50)).toEqual({ value: 100, clamped: false });
  });

  it('clamps up to the previous value when Steam reports a decrease', () => {
    expect(clampPlaytime(40, 50)).toEqual({ value: 50, clamped: true });
  });

  it('does not clamp when equal', () => {
    expect(clampPlaytime(50, 50)).toEqual({ value: 50, clamped: false });
  });

  it('treats no prior value (0) as the floor', () => {
    expect(clampPlaytime(10, 0)).toEqual({ value: 10, clamped: false });
  });
});
