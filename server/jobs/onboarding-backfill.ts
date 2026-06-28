/**
 * First-login onboarding backfill job (Task 06 — #64).
 *
 * On a user's FIRST sign-in, bootstraps their dashboard:
 *   1. Fetches profile summary + owned games via the rate-limited Steam client
 *      (through the cached profile repository — never inline fetch).
 *   2. Upserts the User reference row, Game + OwnedGame reference rows.
 *   3. Seeds an initial PlaytimeSnapshot for today so history starts immediately.
 *   4. Sets onboardedAt on the User row so subsequent calls return early.
 *
 * Idempotency: guarded by `onboardedAt` on the User row. If already set, we
 * return early without any further I/O — concurrent logins and re-runs are safe.
 *
 * Rate-limiting: reuses getProfile() from server/repositories/profile, which
 * calls the shared token-bucket limiter in lib/steam/limiter.ts. No new limiter.
 *
 * Degradation: private profile → { onboarded: false, reason: 'private' }.
 * Transient errors → { onboarded: false, reason: 'error' }. Never throws.
 */

import { prisma } from '@/server/db';
import { getProfile } from '@/server/repositories/profile';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { isSteamApiError } from '@/lib/steam/errors';
import { utcDayKey, clampPlaytime, recordAchievementUnlocks } from '@/server/jobs/snapshot';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OnboardingResult {
  onboarded: boolean;
  reason?: 'private' | 'error';
}

// ---------------------------------------------------------------------------
// runOnboardingBackfill
// ---------------------------------------------------------------------------

/**
 * Bootstraps a newly signed-in user's dashboard data.
 *
 * @param steamId - The 17-digit SteamID64 of the user. Required — throws
 *   MissingSteamIdError if blank (consistent with repository contract).
 * @returns { onboarded: true } on success, or { onboarded: false, reason }
 *   on private-profile or transient failure. Never throws.
 */
export async function runOnboardingBackfill(
  steamId: string,
  opts?: { force?: boolean; achievementUnlockLimit?: number },
): Promise<OnboardingResult> {
  // Throws MissingSteamIdError synchronously for blank input — callers can
  // let this propagate (it is a programming error, not a runtime failure).
  const id = requireSteamId(steamId, 'runOnboardingBackfill');

  // ------------------------------------------------------------------
  // Idempotency guard — check if this user has already been onboarded.
  // If onboardedAt is set AND force is not true, return immediately.
  // With force:true (re-sync) we skip this guard and re-run the upserts;
  // idempotency is preserved by upsert + day-keyed snapshot key.
  // ------------------------------------------------------------------
  if (!opts?.force) {
    const existing = await prisma.user.findUnique({
      where: { steamId: id },
      select: { onboardedAt: true },
    });
    if (existing?.onboardedAt != null) {
      return { onboarded: true };
    }
  }

  // ------------------------------------------------------------------
  // Fetch profile + owned games via the cached, rate-limited repository.
  // ------------------------------------------------------------------
  let profile: Awaited<ReturnType<typeof getProfile>>['profile'];
  let games: Awaited<ReturnType<typeof getProfile>>['games'];

  try {
    const result = await getProfile(id);
    profile = result.profile;
    games = result.games;
  } catch (err) {
    // Duck-type the SteamApiError kind — avoids instanceof cross-module failures
    // when the error is thrown from a vi.doMock'd module instance in tests.
    const kind = (err as { kind?: string }).kind;
    if (kind === 'private') {
      return { onboarded: false, reason: 'private' };
    }
    // Transient errors (5xx, network, schema) — degrade gracefully.
    console.error('[onboarding-backfill] Steam fetch failed for steamId=%s', id, err);
    return { onboarded: false, reason: 'error' };
  }

  const dayKey = utcDayKey();

  // ------------------------------------------------------------------
  // All reference writes + the onboardedAt stamp are wrapped in a single
  // $transaction so onboardedAt only commits if every write succeeds.
  // recordAchievementUnlocks stays outside (best-effort, not structural).
  // ------------------------------------------------------------------
  await prisma.$transaction(async (tx) => {
    // Upsert the User reference row.
    await tx.user.upsert({
      where: { steamId: id },
      create: {
        steamId: id,
        personaName: profile.personaName,
        avatarUrl: profile.avatar.full,
        countryCode: profile.countryCode ?? null,
        // createdAt is an ISO-8601 string from PlayerSummarySchema; epoch signals
        // "unknown" when Steam omits timecreated (private/new accounts).
        createdAt: profile.createdAt ? new Date(profile.createdAt) : new Date(0),
      },
      update: {
        personaName: profile.personaName,
        avatarUrl: profile.avatar.full,
        countryCode: profile.countryCode ?? null,
        lastSyncedAt: new Date(),
      },
    });

    // Upsert Game + OwnedGame reference rows for each owned game.
    for (const game of games) {
      await tx.game.upsert({
        where: { appId: game.appId },
        create: {
          appId: game.appId,
          name: game.name,
          iconUrl: game.iconUrl ?? null,
          headerUrl: null,
          releaseDate: null,
          genres: '[]',
          hasStats: game.hasAchievements ?? false,
        },
        update: {
          name: game.name,
          iconUrl: game.iconUrl ?? null,
          refreshedAt: new Date(),
        },
      });

      await tx.ownedGame.upsert({
        where: { steamId_appId: { steamId: id, appId: game.appId } },
        create: {
          steamId: id,
          appId: game.appId,
          playtimeForever: game.playtime.total,
          playtimeTwoWeeks: game.playtime.twoWeeks ?? 0,
          // lastPlayed is an ISO-8601 string from OwnedGameSchema (nullable)
          lastPlayedAt: game.lastPlayed ? new Date(game.lastPlayed) : null,
        },
        update: {
          playtimeForever: game.playtime.total,
          playtimeTwoWeeks: game.playtime.twoWeeks ?? 0,
          lastPlayedAt: game.lastPlayed ? new Date(game.lastPlayed) : null,
          refreshedAt: new Date(),
        },
      });
    }

    // Seed initial PlaytimeSnapshot for today.
    // Uses per-row upsert (not createMany) for SQLite compatibility (ERR-0005).
    for (const game of games) {
      const { value } = clampPlaytime(game.playtime.total, 0);
      await tx.playtimeSnapshot.upsert({
        where: { steamId_appId_date: { steamId: id, appId: game.appId, date: dayKey } },
        create: { steamId: id, appId: game.appId, date: dayKey, playtimeForever: value },
        update: {}, // immutable once written — idempotent re-run
      });
    }

    // Mark the user as onboarded — only commits if all the above succeed.
    await tx.user.update({
      where: { steamId: id },
      data: { onboardedAt: new Date() },
    });
  });

  // ------------------------------------------------------------------
  // Seed per-achievement unlock events (#91) — best-effort, outside the
  // transaction: a Steam failure here must not roll back the onboarding.
  // Thread the optional limit from the resync path (bounded fan-out).
  // ------------------------------------------------------------------
  try {
    await recordAchievementUnlocks(id, games, opts?.achievementUnlockLimit);
  } catch (err) {
    console.error('[onboarding-backfill] achievement unlock seeding failed for steamId=%s', id, err);
  }

  return { onboarded: true };
}
