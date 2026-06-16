/**
 * POST /api/cron/snapshot — trigger the nightly snapshot job (#25).
 *
 * Auth is a dedicated timing-safe check, NOT `withErrorBoundary` (which has no
 * 401-without-Steam path): the request must carry an `x-cron-secret` header
 * equal to `CRON_SECRET`. Missing/unconfigured/mismatched → 401. We compare
 * SHA-256 digests so the inputs are always equal length (timingSafeEqual throws
 * on length mismatch) and the comparison leaks neither length nor content.
 *
 * The job itself is idempotent (compound unique on `(steamId, appId, date)`), so
 * a retried cron tick is safe.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { runSnapshot } from '@/server/jobs';
import { getEnv } from '@/server/env';
import { problemResponse } from '@/server/api/problem';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const { CRON_SECRET } = getEnv();
  if (!CRON_SECRET) return false; // unconfigured → deny
  const provided = request.headers.get('x-cron-secret');
  if (provided === null) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(CRON_SECRET).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const instance = new URL(request.url).pathname;

  if (!isAuthorized(request)) {
    return problemResponse({
      type: 'https://4es-dash/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid x-cron-secret header.',
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
