/**
 * server/onboarding-gate.ts
 *
 * Reusable onboarding-status guard for protected "my" views.
 *
 * A session user whose `User.onboardedAt` is null has authenticated but has
 * NOT yet visited `/onboarding` (i.e. `runOnboardingBackfill` has not run).
 * Showing them an empty data state ("No genre data yet") would be misleading;
 * instead, redirect to `/onboarding` or render a designed "Syncing…" state.
 *
 * This helper is intentionally cheap: it reads ONE column from ONE row.
 * It does NOT call `runOnboardingBackfill` — heavy Steam fan-out must stay
 * off the interactive render path (see 02-architecture.md §Decisions).
 *
 * Usage:
 *   const status = await getOnboardingStatus();
 *   // status: "no-session" | "not-onboarded" | "onboarded"
 */

import { prisma } from '@/server/db';
import { getSessionUser } from '@/server/auth';

// ---------------------------------------------------------------------------
// Public type
// ---------------------------------------------------------------------------

export type OnboardingGateStatus = 'no-session' | 'not-onboarded' | 'onboarded';

// ---------------------------------------------------------------------------
// getOnboardingStatus
// ---------------------------------------------------------------------------

/**
 * Returns the onboarding status for the current session user.
 *
 * - "no-session"     — no authenticated session (unauthenticated visitor).
 * - "not-onboarded"  — session exists but `User.onboardedAt` is null;
 *                      the user authenticated but never ran the backfill.
 * - "onboarded"      — `User.onboardedAt` is set; data is available.
 *
 * Never throws; caller decides what to do with each status.
 */
export async function getOnboardingStatus(
  sessionUser?: { steamId: string } | null,
): Promise<OnboardingGateStatus> {
  // De-dupe the session waterfall: an RSC page that also resolves the viewer
  // (getViewerSteamId) can pass the already-fetched session through so we don't
  // call getSessionUser twice on the same render.
  const resolved = sessionUser !== undefined ? sessionUser : await getSessionUser();
  if (resolved === null) {
    return 'no-session';
  }

  const row = await prisma.user.findUnique({
    where: { steamId: resolved.steamId },
    select: { onboardedAt: true },
  });

  if (row?.onboardedAt == null) {
    return 'not-onboarded';
  }

  return 'onboarded';
}
