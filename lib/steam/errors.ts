/**
 * The single error type the Steam layer throws. Every failure mode is one of
 * the six kinds below; route handlers map the kind to an RFC 7807 problem via
 * `withErrorBoundary`. The API key is never included in the message or cause.
 * See docs/BACKEND.md and docs/API.md.
 */
export type SteamErrorKind =
  | 'rate_limit' // Steam returned 429
  | 'auth' // bad or missing API key (401/403 from Steam on the key)
  | 'private' // profile/library not public (IPlayerService returns {})
  | 'transient' // upstream 5xx / network error after retries
  | 'schema' // response did not match the expected shape (Zod failure)
  | 'unknown'; // anything else

export interface SteamApiErrorInit {
  kind: SteamErrorKind;
  message?: string;
  /** Upstream HTTP status, when the failure came from a response. */
  status?: number;
  /** Seconds to wait before retrying, parsed from a 429 `Retry-After` header. */
  retryAfter?: number;
  /** Underlying error, kept off the wire. */
  cause?: unknown;
}

export class SteamApiError extends Error {
  readonly kind: SteamErrorKind;
  readonly status?: number;
  readonly retryAfter?: number;

  constructor(init: SteamApiErrorInit) {
    super(init.message ?? `Steam API error: ${init.kind}`);
    this.name = 'SteamApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.retryAfter = init.retryAfter;
    if (init.cause !== undefined) this.cause = init.cause;
  }
}

/** Narrowing helper for callers and the error boundary. */
export function isSteamApiError(error: unknown): error is SteamApiError {
  return error instanceof SteamApiError;
}
