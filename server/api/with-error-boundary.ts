/**
 * Higher-order function that wraps a Next.js route handler with a catch-all
 * error boundary. Converts SteamApiError, ZodError, and unexpected throws into
 * RFC 7807 problem responses. Never leaks internal error messages to the client.
 * See docs/API.md and docs/BACKEND.md §Error handling.
 */

import { ZodError } from 'zod';
import { isSteamApiError } from '@/lib/steam/errors';
import { PROBLEM_CATALOG, problemResponse, steamKindToProblem } from './problem';

export type RouteHandler<C = unknown> = (
  request: Request,
  context: C,
) => Response | Promise<Response>;

/**
 * Wrap a route handler so all throws become RFC 7807 problem responses.
 *
 * Error mapping:
 * - SteamApiError  → mapped by kind (see steamKindToProblem)
 * - ZodError       → 400 validation (field paths/messages, no internals)
 * - anything else  → 500 internal (generic detail + requestId for correlation)
 */
export function withErrorBoundary<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request: Request, context: C): Promise<Response> => {
    const instance = new URL(request.url).pathname;

    try {
      return await handler(request, context);
    } catch (err) {
      // ── SteamApiError ────────────────────────────────────────────────────
      if (isSteamApiError(err)) {
        const { problem, headers } = steamKindToProblem(err, instance);
        return problemResponse(problem, headers);
      }

      // ── ZodError (request validation) ───────────────────────────────────
      if (err instanceof ZodError) {
        const detail = err.issues
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; ');

        return problemResponse({
          type: `https://4es-dash/errors/validation`,
          title: 'Request validation failed',
          status: PROBLEM_CATALOG['validation'].status,
          detail,
          instance,
        });
      }

      // ── Unknown error ────────────────────────────────────────────────────
      const requestId = crypto.randomUUID();
      // eslint-disable-next-line no-console
      console.error('[unhandled]', requestId, err);

      return problemResponse({
        type: `https://4es-dash/errors/internal`,
        title: PROBLEM_CATALOG['internal'].title,
        status: PROBLEM_CATALOG['internal'].status,
        detail: `An unexpected error occurred. Reference ID: ${requestId}`,
        instance,
      });
    }
  };
}
