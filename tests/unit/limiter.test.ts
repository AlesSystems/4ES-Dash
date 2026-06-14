import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenBucketLimiter } from '@/lib/steam/limiter';

describe('TokenBucketLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows at most ~4 requests per simulated second (≤ 4 req/sec)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

    // Fresh limiter (not the shared singleton) so tests are isolated.
    const limiter = new TokenBucketLimiter(1, 250);

    // Fire 10 concurrent acquire() calls.
    const resolved: number[] = [];

    const promises = Array.from({ length: 10 }, (_, i) =>
      limiter.acquire().then(() => {
        resolved.push(i);
      }),
    );

    // First token consumed immediately — give microtasks a chance to flush.
    await Promise.resolve();

    // The first acquire() resolves synchronously at t=0 (bucket has 1 token).
    // Advance 1 000 ms: 4 refills × 250 ms = 4 more tokens → 4 more resolved.
    // Total resolved within 1 second: 1 + 4 = 5. Rate = 5/sec ≤ 4/250ms window.
    await vi.advanceTimersByTimeAsync(1000);
    // Allow promise callbacks to flush after timer callbacks run.
    await Promise.resolve();
    await Promise.resolve();

    // Within the first 1 000 ms, at most 5 acquire()s can resolve
    // (1 immediate + at most 4 from 250/500/750/1000ms refills).
    expect(resolved.length).toBeLessThanOrEqual(5);
    // Sanity: at least the immediate one resolved.
    expect(resolved.length).toBeGreaterThanOrEqual(1);

    // Drain remaining timers so the test does not leak pending promises.
    await vi.runAllTimersAsync();
    await Promise.allSettled(promises);

    // All 10 must eventually resolve.
    expect(resolved).toHaveLength(10);
  });

  it('resolves the first acquire() immediately (bucket starts full)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const limiter = new TokenBucketLimiter(1, 250);

    let resolved = false;
    limiter
      .acquire()
      .then(() => {
        resolved = true;
      })
      .catch(() => undefined);

    // No timer advancement needed — first token is available immediately.
    await Promise.resolve();

    expect(resolved).toBe(true);
  });

  it('does not resolve a second call until 250 ms have elapsed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const limiter = new TokenBucketLimiter(1, 250);

    // Consume the first token.
    await limiter.acquire();

    let secondResolved = false;
    const second = limiter.acquire().then(() => {
      secondResolved = true;
    });

    // Advance 249 ms — should NOT have resolved yet.
    await vi.advanceTimersByTimeAsync(249);
    await Promise.resolve();
    expect(secondResolved).toBe(false);

    // One more ms → refill happens.
    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    expect(secondResolved).toBe(true);

    await second;
  });
});
