/**
 * Unit tests for server/cache.ts
 * Environment: node (vitest default)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cache, cacheKey, clearCache } from '@/server/cache';

beforeEach(() => {
  clearCache();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// cacheKey helper
// ---------------------------------------------------------------------------

describe('cacheKey', () => {
  it('builds a key without appId', () => {
    expect(cacheKey('owned-games', '76561198000000000')).toBe(
      'steam:owned-games:76561198000000000',
    );
  });

  it('appends appId when provided', () => {
    expect(cacheKey('owned-games', '76561198000000000', 730)).toBe(
      'steam:owned-games:76561198000000000:730',
    );
  });

  it('normalises endpoint to lowercase', () => {
    expect(cacheKey('OwnedGames', '76561198000000000')).toBe('steam:ownedgames:76561198000000000');
  });
});

// ---------------------------------------------------------------------------
// Miss then hit
// ---------------------------------------------------------------------------

describe('cache — miss then hit', () => {
  it('calls loader on miss, skips loader on subsequent hit within TTL', async () => {
    const loader = vi.fn().mockResolvedValue(42);

    const first = await cache('test:miss-hit', 60, loader);
    expect(first).toEqual({ value: 42, stale: false });
    expect(loader).toHaveBeenCalledTimes(1);

    const second = await cache('test:miss-hit', 60, loader);
    expect(second).toEqual({ value: 42, stale: false });
    // Loader must NOT have been called again
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

describe('cache — expiry', () => {
  it('re-invokes loader after TTL has elapsed', async () => {
    vi.useFakeTimers();

    const loader = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    await cache('test:expiry', 30, loader); // ttl = 30 s
    expect(loader).toHaveBeenCalledTimes(1);

    // Advance past TTL
    vi.advanceTimersByTime(31_000);

    const result = await cache('test:expiry', 30, loader);
    expect(result).toEqual({ value: 'second', stale: false });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Stale-while-revalidate
// ---------------------------------------------------------------------------

describe('cache — stale-while-revalidate', () => {
  it('returns previous value with stale:true when loader throws on a warm key', async () => {
    vi.useFakeTimers();

    // Prime the cache with a successful load
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ data: 'good' })
      .mockRejectedValueOnce(new Error('upstream failure'));

    await cache('test:swr', 30, loader);

    // Advance past TTL so the entry is expired
    vi.advanceTimersByTime(31_000);

    // Second call — loader throws
    const result = await cache('test:swr', 30, loader);
    expect(result).toEqual({ value: { data: 'good' }, stale: true });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not propagate the error when a stale value is available', async () => {
    vi.useFakeTimers();

    const loader = vi.fn().mockResolvedValueOnce('cached').mockRejectedValueOnce(new Error('boom'));

    await cache('test:swr-no-throw', 10, loader);
    vi.advanceTimersByTime(11_000);

    await expect(cache('test:swr-no-throw', 10, loader)).resolves.toMatchObject({
      stale: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Cold failure
// ---------------------------------------------------------------------------

describe('cache — cold failure', () => {
  it('rethrows when there is no prior value and loader rejects', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('cold error'));

    await expect(cache('test:cold', 60, loader)).rejects.toThrow('cold error');
  });
});
