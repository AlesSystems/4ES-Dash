import { describe, expect, it } from 'vitest';
import { available, isAvailable, unavailable, type Availability } from '@/lib/result';

describe('result — graceful degradation helpers (#14)', () => {
  it('available() wraps data and defaults stale to false', () => {
    const r = available(42);
    expect(r).toEqual({ available: true, data: 42, stale: false });
  });

  it('available() carries a stale flag when passed', () => {
    expect(available('x', true).stale).toBe(true);
  });

  it('unavailable() omits message when not provided', () => {
    expect(unavailable('private')).toEqual({ available: false, reason: 'private' });
  });

  it('unavailable() includes message when provided', () => {
    expect(unavailable('metadata-unavailable', 'Store down')).toEqual({
      available: false,
      reason: 'metadata-unavailable',
      message: 'Store down',
    });
  });

  it('isAvailable() narrows to the data branch', () => {
    const r: Availability<number> = available(7);
    if (isAvailable(r)) {
      // type-level: r.data is number here
      expect(r.data).toBe(7);
    } else {
      throw new Error('expected available');
    }
    expect(isAvailable(unavailable('empty'))).toBe(false);
  });
});
