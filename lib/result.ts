/**
 * Graceful-degradation result type (issue #14).
 *
 * Steam does not expose everything (price-paid, acquisition date, friends
 * activity, sometimes whole responses go private). Rather than throw or
 * fabricate a zero, data-layer functions for T2/T4 features return an
 * `Availability<T>`: either the data, or a typed `{ available: false, reason }`
 * the UI maps to a *designed* empty state.
 *
 * This is a pure module (client-safe): it lives in `lib/`, imports nothing
 * server-only, and is the single shape every degradable feature reuses.
 * See docs/STEAM_DATA_SOURCES.md §Data availability & degradation strategy.
 */

/** Why a piece of data could not be shown. Drives which empty state renders. */
export type UnavailableReason =
  | 'private' // profile / library / achievements set to private
  | 'no-achievements' // the game genuinely has no achievement schema
  | 'metadata-unavailable' // Store API unreachable / non-200 / unexpected shape
  | 'not-tracked' // needs history we don't have yet (T4 — e.g. acquiredAt)
  | 'empty' // valid response, but nothing to show (e.g. nothing played)
  | 'unknown'; // anything else we chose to degrade rather than crash on

export interface Available<T> {
  readonly available: true;
  readonly data: T;
  /** True when served from expired cache after an upstream fetch failure. */
  readonly stale: boolean;
}

export interface Unavailable {
  readonly available: false;
  readonly reason: UnavailableReason;
  /** Optional human-readable detail for the empty state (never an API key/secret). */
  readonly message?: string;
}

export type Availability<T> = Available<T> | Unavailable;

/** Wrap a present value. `stale` defaults to false. */
export function available<T>(data: T, stale = false): Available<T> {
  return { available: true, data, stale };
}

/** Build a typed unavailable result. */
export function unavailable(reason: UnavailableReason, message?: string): Unavailable {
  return message !== undefined
    ? { available: false, reason, message }
    : { available: false, reason };
}

/** Narrowing guard — lets callers branch and access `.data` with type safety. */
export function isAvailable<T>(result: Availability<T>): result is Available<T> {
  return result.available;
}
