import { withErrorBoundary } from '@/server/api';
import { getProfile } from '@/server/repositories/profile';
import { ProfileResponse } from '@/lib/zod/api/profile';
import { getViewerSteamId } from '@/server/auth';

/**
 * Opt out of static prerendering — this route reads env vars and live data
 * and must always run at request time.
 */
export const dynamic = 'force-dynamic';

/**
 * GET /api/profile
 *
 * Returns the configured user's Steam profile and owned game library.
 * Errors are handled by withErrorBoundary: SteamApiError → RFC 7807,
 * ZodError → 400, unhandled → 500. No try/catch inside this handler.
 */
export const GET = withErrorBoundary(async () => {
  const featuredId = await getViewerSteamId();
  const data = await getProfile(featuredId);

  // In dev: validate the outgoing response shape to catch regressions early.
  // In prod: skip parse overhead; trust the Steam schemas validated upstream.
  // Either way, `stale` is an internal flag — excluded from the response body.
  const body: ProfileResponse =
    process.env.NODE_ENV !== 'production'
      ? ProfileResponse.parse({ profile: data.profile, games: data.games })
      : { profile: data.profile, games: data.games };

  return Response.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
});
