/**
 * RFC 7807 problem detail response helpers for all route handlers.
 * Maps SteamApiError kinds and ZodErrors to structured JSON bodies.
 * See docs/API.md error catalog.
 */

import type { SteamApiError } from '@/lib/steam/errors';

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

const BASE_TYPE = 'https://4es-dash/errors';

/**
 * Slug → {status, title} lookup table for tests and internal mapping.
 * Exported so tests can assert against exact values without duplicating them.
 */
export const PROBLEM_CATALOG = {
  'steam-rate-limit': { status: 429, title: 'Steam rate limit exceeded' },
  'steam-auth': { status: 401, title: 'Steam API authentication failed' },
  'steam-private-profile': { status: 403, title: 'Steam profile is private' },
  'steam-transient': { status: 502, title: 'Steam API temporarily unavailable' },
  validation: { status: 400, title: 'Response validation failed' },
  // TODO(phase-0-§3): add 'not-found' (404) when /api routes can 404 on missing resources.
  'not-found': { status: 404, title: 'Resource not found' },
  internal: { status: 500, title: 'Internal server error' },
} as const satisfies Record<string, { status: number; title: string }>;

export type ProblemSlug = keyof typeof PROBLEM_CATALOG;

/**
 * Build a Response with Content-Type: application/problem+json.
 * Cache-Control is set to private, no-store so problem bodies are never cached.
 */
export function problemResponse(
  problem: ProblemDetail,
  extraHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/problem+json',
    'Cache-Control': 'private, no-store',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers,
  });
}

/**
 * Map a SteamApiError to a ProblemDetail + optional extra headers.
 * Retry-After is forwarded when present on rate_limit errors.
 */
export function steamKindToProblem(
  err: SteamApiError,
  instance: string,
): { problem: ProblemDetail; headers?: Record<string, string> } {
  switch (err.kind) {
    case 'rate_limit': {
      const slug = 'steam-rate-limit';
      const { status, title } = PROBLEM_CATALOG[slug];
      const problem: ProblemDetail = {
        type: `${BASE_TYPE}/${slug}`,
        title,
        status,
        detail: 'The Steam API rate limit was reached. Please retry after the specified delay.',
        instance,
      };
      const headers: Record<string, string> | undefined =
        err.retryAfter !== undefined ? { 'Retry-After': String(err.retryAfter) } : undefined;
      return { problem, headers };
    }

    case 'auth': {
      const slug = 'steam-auth';
      const { status, title } = PROBLEM_CATALOG[slug];
      return {
        problem: {
          type: `${BASE_TYPE}/${slug}`,
          title,
          status,
          detail: 'Steam API authentication failed. Check that the API key is valid.',
          instance,
        },
      };
    }

    case 'private': {
      const slug = 'steam-private-profile';
      const { status, title } = PROBLEM_CATALOG[slug];
      return {
        problem: {
          type: `${BASE_TYPE}/${slug}`,
          title,
          status,
          detail: 'The requested Steam profile is set to private.',
          instance,
        },
      };
    }

    case 'transient': {
      const slug = 'steam-transient';
      const { status, title } = PROBLEM_CATALOG[slug];
      return {
        problem: {
          type: `${BASE_TYPE}/${slug}`,
          title,
          status,
          detail: 'The Steam API is temporarily unavailable. Please try again later.',
          instance,
        },
      };
    }

    case 'schema': {
      const slug = 'validation';
      const { status } = PROBLEM_CATALOG[slug];
      // Override title for schema errors (upstream response failed validation)
      return {
        problem: {
          type: `${BASE_TYPE}/${slug}`,
          title: 'Response validation failed',
          status,
          detail: 'The Steam API returned an unexpected response shape.',
          instance,
        },
      };
    }

    case 'unknown':
    default: {
      const slug = 'internal';
      const { status, title } = PROBLEM_CATALOG[slug];
      return {
        problem: {
          type: `${BASE_TYPE}/${slug}`,
          title,
          status,
          detail: 'An unexpected error occurred.',
          instance,
        },
      };
    }
  }
}
