/**
 * server/repositories/account.ts
 *
 * Account-level data operations for Task 08 (privacy controls + account settings).
 *
 * Exports:
 *   deleteAccountData(steamId) — atomically delete ALL of a user's rows:
 *     children first (FK order), User row last. Uses a single $transaction so
 *     a partial failure rolls back and leaves no orphaned PII silently.
 *
 *   resyncAccount(steamId) — thin wrapper that calls runOnboardingBackfill with
 *     { force: true } to bypass the onboardedAt early-return and re-fetch
 *     profile/games + refresh today's snapshot. Idempotent via upsert + day-key.
 *
 * NOTE: Because we use JWT sessions (ADR §2), there are NO Account/Session/
 * VerificationToken tables to clean. The session cookie is a signed JWT that
 * lives only on the client — deleting the User row is sufficient to remove all
 * server-side PII. The caller (deleteAccount action) clears the client cookie
 * by calling next-auth signOut / redirect after this function returns.
 */

import { prisma } from '@/server/db';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { runOnboardingBackfill, type OnboardingResult } from '@/server/jobs/onboarding-backfill';

// ---------------------------------------------------------------------------
// deleteAccountData
// ---------------------------------------------------------------------------

/**
 * Atomically deletes ALL data belonging to `steamId`.
 *
 * Deletion order (children before parent, FK-safe):
 *   1. PlaytimeSnapshot    (FK → User.steamId)
 *   2. AchievementSnapshot (FK → User.steamId)
 *   3. OwnedGame           (FK → User.steamId)
 *   4. ManualGameData      (no FK, but user-keyed)
 *   5. IdleDismissal       (no FK, but user-keyed)
 *   6. User                (the identity row — last)
 *
 * Wrapped in a single $transaction so a partial failure rolls back and no
 * orphaned PII rows are silently left behind.
 *
 * @throws MissingSteamIdError if steamId is blank.
 * @throws Prisma errors propagated from the transaction (caller should handle).
 */
export async function deleteAccountData(steamId: string): Promise<void> {
  const id = requireSteamId(steamId, 'deleteAccountData');

  await prisma.$transaction(async (tx) => {
    // Children before parent (FK order)
    await tx.playtimeSnapshot.deleteMany({ where: { steamId: id } });
    await tx.achievementSnapshot.deleteMany({ where: { steamId: id } });
    await tx.ownedGame.deleteMany({ where: { steamId: id } });
    // ManualGameData and IdleDismissal have no FK constraint to User in SQLite
    // but are logically user-owned — delete them too.
    await tx.manualGameData.deleteMany({ where: { steamId: id } });
    await tx.idleDismissal.deleteMany({ where: { steamId: id } });
    // User row last — all children already removed above.
    await tx.user.delete({ where: { steamId: id } });
  });
}

// ---------------------------------------------------------------------------
// resyncAccount
// ---------------------------------------------------------------------------

/**
 * Re-runs the onboarding backfill for an existing user, bypassing the
 * `onboardedAt` early-return guard. This re-fetches profile/games and
 * refreshes today's snapshot.
 *
 * Idempotent: upsert + day-keyed snapshot key means no duplicate rows even
 * if called multiple times on the same day.
 *
 * @throws MissingSteamIdError if steamId is blank (via runOnboardingBackfill).
 * @returns The OnboardingResult from the backfill.
 */
export async function resyncAccount(
  steamId: string,
  achievementUnlockLimit?: number,
): Promise<OnboardingResult> {
  // requireSteamId is called inside runOnboardingBackfill — no need to duplicate.
  return runOnboardingBackfill(steamId, { force: true, achievementUnlockLimit });
}
