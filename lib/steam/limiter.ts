/**
 * Token-bucket rate limiter for the Steam Web API.
 *
 * Capacity: 1 token.
 * Refill:   1 token every REFILL_INTERVAL_MS (250 ms → ≤ 4 req/sec).
 *
 * Designed to work with `vi.useFakeTimers()` in tests: all scheduling goes
 * through `setTimeout` only — no `Date.now()` calls — so fake timers give
 * deterministic control over pacing.
 */

const REFILL_INTERVAL_MS = 250;

export class TokenBucketLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillIntervalMs: number;
  /** Resolvers queued while the bucket is empty. */
  private readonly waiting: Array<() => void> = [];
  /** True while a refill timer is already scheduled (prevents double-scheduling). */
  private refillScheduled = false;

  constructor(capacity = 1, refillIntervalMs = REFILL_INTERVAL_MS) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillIntervalMs = refillIntervalMs;
  }

  /**
   * Resolves when a token is available.  If the bucket is empty, queues the
   * caller and schedules a single refill timer (subsequent callers re-use the
   * same pending timer cycle).
   */
  async acquire(): Promise<void> {
    if (this.tryConsume()) return;

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
      this.ensureRefillScheduled();
    });
  }

  private tryConsume(): boolean {
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  /**
   * Schedules one refill timer if none is already pending.  Uses the fixed
   * interval so there is no reliance on `Date.now()`.
   */
  private ensureRefillScheduled(): void {
    if (this.refillScheduled) return;
    this.refillScheduled = true;

    setTimeout(() => {
      this.refillScheduled = false;
      this.tokens = Math.min(this.capacity, this.tokens + 1);
      this.drain();
    }, this.refillIntervalMs);
  }

  /** Release as many waiting promises as there are tokens, then schedule the
   *  next refill cycle if callers are still queued. */
  private drain(): void {
    while (this.tokens > 0 && this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next !== undefined) {
        this.tokens--;
        next();
      }
    }

    // If callers are still waiting, schedule the next refill.
    if (this.waiting.length > 0) {
      this.ensureRefillScheduled();
    }
  }
}

/** Shared singleton for the Steam Web API (1 req / 250 ms). */
export const steamLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);

/**
 * Dedicated limiter for SteamSpy's appdetails endpoint, which asks for
 * ≤ 1 req/sec — slower than the Steam Web API. The shared `steamLimiter`
 * (4 req/sec) would not honour SteamSpy's policy, so SteamSpy calls use this.
 */
export const steamSpyLimiter = new TokenBucketLimiter(1, 1000);
