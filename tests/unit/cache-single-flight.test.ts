import { describe, it, expect, beforeEach } from 'vitest';
import { cache, clearCache } from '@/server/cache';

/**
 * Single-flight de-dup (#85): N concurrent misses on one key must invoke the
 * loader exactly once and all share the result. Stale-while-revalidate behaviour
 * is preserved when the shared loader fails.
 */

beforeEach(() => {
  clearCache();
});

/** A loader whose resolution we control, counting how many times it is invoked. */
function deferredLoader<T>() {
  let calls = 0;
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const fn = () => {
    calls += 1;
    return new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  };
  return {
    fn,
    resolve: (v: T) => resolve(v),
    reject: (e: unknown) => reject(e),
    get calls() {
      return calls;
    },
  };
}

describe('cache single-flight', () => {
  it('invokes the loader exactly once for N concurrent misses on the same key', async () => {
    const loader = deferredLoader<number>();

    const p1 = cache('k', 60, loader.fn);
    const p2 = cache('k', 60, loader.fn);
    const p3 = cache('k', 60, loader.fn);

    loader.resolve(42);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(loader.calls).toBe(1);
    expect(r1.value).toBe(42);
    expect(r2.value).toBe(42);
    expect(r3.value).toBe(42);
    expect(r1.stale).toBe(false);
  });

  it('does NOT de-dup across different keys', async () => {
    const a = deferredLoader<string>();
    const b = deferredLoader<string>();

    const pa = cache('a', 60, a.fn);
    const pb = cache('b', 60, b.fn);

    a.resolve('A');
    b.resolve('B');

    const [ra, rb] = await Promise.all([pa, pb]);
    expect(ra.value).toBe('A');
    expect(rb.value).toBe('B');
    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('clears the in-flight slot so a later miss re-runs the loader', async () => {
    const first = deferredLoader<number>();
    const p1 = cache('k', 0 /* expire immediately */, first.fn);
    first.resolve(1);
    await p1;

    // TTL 0 → already expired → next call is a fresh miss, loader runs again.
    const second = deferredLoader<number>();
    const p2 = cache('k', 60, second.fn);
    second.resolve(2);
    const r2 = await p2;

    expect(second.calls).toBe(1);
    expect(r2.value).toBe(2);
  });

  it('preserves stale-while-revalidate: concurrent joiners get the prior value when the shared loader fails', async () => {
    // Seed a value.
    await cache('k', 0 /* expire immediately */, async () => 'seed');

    // Now both miss (expired) and the shared loader rejects.
    const failing = deferredLoader<string>();
    const p1 = cache('k', 60, failing.fn);
    const p2 = cache('k', 60, failing.fn);
    failing.reject(new Error('upstream down'));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(loaderRanOnce(failing.calls)).toBe(true);
    expect(r1.value).toBe('seed');
    expect(r1.stale).toBe(true);
    expect(r2.value).toBe('seed');
    expect(r2.stale).toBe(true);
  });

  it('rethrows for concurrent cold misses with no prior value when the loader fails', async () => {
    const failing = deferredLoader<string>();
    const p1 = cache('cold', 60, failing.fn);
    const p2 = cache('cold', 60, failing.fn);
    failing.reject(new Error('boom'));

    await expect(p1).rejects.toThrow('boom');
    await expect(p2).rejects.toThrow('boom');
    expect(failing.calls).toBe(1);
  });
});

function loaderRanOnce(calls: number): boolean {
  return calls === 1;
}
