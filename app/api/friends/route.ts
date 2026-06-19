import { withErrorBoundary } from '@/server/api';
import { getFriends } from '@/server/repositories/friends';
import { FriendsResponse } from '@/lib/zod/api/friends';
import { getSessionUser } from '@/server/auth';

/**
 * Opt out of static prerendering — this route reads env vars and live data
 * and must always run at request time.
 */
export const dynamic = 'force-dynamic';

/**
 * GET /api/friends
 *
 * Returns the authenticated user's Steam friend list with enriched player
 * summaries, sorted non-offline first then alphabetically within groups.
 * Anonymous requests receive 401 — this route must NOT fall back to the
 * owner's STEAM_ID (ERR-0013 privacy fix).
 *
 * Errors are handled by withErrorBoundary: SteamApiError → RFC 7807,
 * ZodError → 400, unhandled → 500. No try/catch inside this handler.
 *
 * Private friend list → SteamApiError({ kind: 'private' }) → 403.
 */
export const GET = withErrorBoundary(async () => {
  const session = await getSessionUser();
  if (!session) {
    return Response.json(
      { error: 'unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  const { friends } = await getFriends(session.steamId);

  // In dev: validate the outgoing response shape to catch regressions early.
  // In prod: skip parse overhead; trust the Steam schemas validated upstream.
  const body =
    process.env.NODE_ENV !== 'production' ? FriendsResponse.parse({ friends }) : { friends };

  return Response.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
});
