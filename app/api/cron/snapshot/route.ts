/**
 * /api/cron/snapshot — trigger the nightly snapshot job (#25, #86).
 *
 * Auth is a dedicated timing-safe check, NOT `withErrorBoundary` (which has no
 * 401-without-Steam path). A request is authorized if EITHER credential equals
 * `CRON_SECRET` (compared via SHA-256 digests so inputs are equal length and the
 * comparison leaks neither length nor content):
 *
 *   • `Authorization: Bearer <CRON_SECRET>`  — Vercel Cron's default (sent on GET)
 *   • `x-cron-secret: <CRON_SECRET>`         — manual / back-compat (any method)
 *
 * Both GET (Vercel) and POST (manual) are exported and share one handler.
 * Missing/unconfigured/mismatched → 401.
 *
 * The job itself is idempotent (compound unique on `(steamId, appId, date)`), so
 * a retried cron tick is safe.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { runSnapshot } from '@/server/jobs';
import { getEnv } from '@/server/env';
import { problemResponse } from '@/server/api/problem';

export const dynamic = 'force-dynamic';

/** Constant-time equality of two secrets via fixed-length SHA-256 digests. */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function isAuthorized(request: Request): boolean {
  const { CRON_SECRET } = getEnv();
  if (!CRON_SECRET) return false; // unconfigured → deny

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== null) {
    const match = /^Bearer (.+)$/.exec(authHeader);
    if (match?.[1] !== undefined && secretMatches(match[1], CRON_SECRET)) {
      return true;
    }
  }

  // Manual / back-compat: `x-cron-secret: <CRON_SECRET>`.
  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret !== null && secretMatches(headerSecret, CRON_SECRET)) {
    return true;
  }

  return false;
}

async function handle(request: Request): Promise<Response> {
  const instance = new URL(request.url).pathname;

  if (!isAuthorized(request)) {
    return problemResponse({
      type: 'https://4es-dash/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid cron credentials (Authorization: Bearer or x-cron-secret).',
      instance,
    });
  }

  try {
    const result = await runSnapshot();
    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('[cron/snapshot] job failed', err);
    return problemResponse({
      type: 'https://4es-dash/errors/internal',
      title: 'Internal server error',
      status: 500,
      detail: 'The snapshot job failed. See server logs for details.',
      instance,
    });
  }
}

/** Vercel Cron invokes the schedule with a GET + `Authorization: Bearer`. */
export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

/** Manual / back-compat trigger (e.g. `x-cron-secret` from a self-hosted cron). */
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
