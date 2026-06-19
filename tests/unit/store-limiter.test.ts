import { describe, it, expect, vi, afterEach } from 'vitest';
import { steamLimiter, storeLimiter, TokenBucketLimiter } from '@/lib/steam/limiter';

/**
 * The Store API (store.steampowered.com) and the Steam Web API
 * (api.steampowered.com) are different hosts and MUST draw from separate
 * limiters (#85), so a flood of store-price calls (e.g. the nightly
 * library-value pass) never starves a Web API `acquire()` on the request path.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe('store limiter separation (#85)', () => {
  it('storeLimiter and steamLimiter are distinct instances', () => {
    expect(storeLimiter).toBeInstanceOf(TokenBucketLimiter);
    expect(steamLimiter).toBeInstanceOf(TokenBucketLimiter);
    expect(storeLimiter).not.toBe(steamLimiter);
  });

  it('a flood on the store limiter does not delay a Web API acquire', async () => {
    vi.useFakeTimers();

    // Use fresh limiters so the assertion is independent of singleton history,
    // proving the SEPARATION property (two buckets do not share tokens).
    const store = new TokenBucketLimiter(1, 250);
    const web = new TokenBucketLimiter(1, 250);

    // Drain the store bucket and queue several waiters behind it.
    await store.acquire(); // consumes the single token
    let storeResolved = 0;
    void store.acquire().then(() => storeResolved++);
    void store.acquire().then(() => storeResolved++);

    // The Web API bucket is untouched → its acquire resolves immediately,
    // without advancing any timer (i.e. not blocked behind the store flood).
    let webResolved = false;
    await web.acquire().then(() => {
      webResolved = true;
    });

    expect(webResolved).toBe(true);
    // The store waiters are still queued — no refill timer has fired yet.
    expect(storeResolved).toBe(0);
  });
});
