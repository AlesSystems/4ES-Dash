import { isSteamApiError, SteamApiError } from './errors';

// 1 initial attempt + 3 retries = 4 total, with backoff before each retry.
// ACCEPTANCE #9: "retried up to 3 times; a 4th failure throws transient".
const DEFAULT_ATTEMPTS = 4;
const DEFAULT_BACKOFF_MS = [250, 1000, 4000] as const;

export interface RetryOptions {
  /** Total number of attempts (including the first). Default: 4 (1 initial + 3 retries). */
  attempts?: number;
  /** Milliseconds to wait before each retry. Length must be ≥ attempts - 1. */
  backoffMs?: number[];
}

/**
 * Retries `fn` on transient failures.
 *
 * Retryable: `SteamApiError` with `kind === 'transient'`, or any non-Steam
 * network error (treated as transient).
 * Non-retryable: `SteamApiError` with `kind` in `auth | private | rate_limit | schema`.
 *
 * After exhausting all attempts the last error is rethrown as-is if it is
 * already a `SteamApiError({ kind: 'transient' })`; otherwise it is wrapped.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T> {
  const maxAttempts = opts?.attempts ?? DEFAULT_ATTEMPTS;
  const backoff: number[] = opts?.backoffMs ?? [...DEFAULT_BACKOFF_MS];

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Non-retryable Steam errors bubble immediately.
      if (isSteamApiError(err)) {
        if (err.kind !== 'transient') {
          throw err;
        }
        // kind === 'transient' — fall through to retry
      }
      // Non-Steam errors (e.g. raw TypeError from fetch) are treated as transient.

      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt) break;

      const delayMs = backoff[attempt] ?? backoff[backoff.length - 1] ?? 250;
      await sleep(delayMs);
    }
  }

  // Re-throw as SteamApiError({ kind: 'transient' }) after exhausting retries.
  if (isSteamApiError(lastError) && lastError.kind === 'transient') {
    throw lastError;
  }

  throw new SteamApiError({
    kind: 'transient',
    message: 'Request failed after retries',
    cause: lastError,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
