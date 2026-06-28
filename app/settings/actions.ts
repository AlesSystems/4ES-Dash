'use server';

/**
 * app/settings/actions.ts — Server actions for the account settings page.
 *
 * All actions are session-scoped: they always use getSessionUser() to
 * identify the acting user. It is impossible for user A to modify user B's
 * data through these actions — the steamId always comes from the session.
 *
 * Actions:
 *   setPrivacy   — update the authenticated user's privacy level.
 *   resyncNow    — re-run the onboarding backfill with force:true for the session user.
 *   deleteAccount — delete all rows for the session user, then sign out.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSessionUser } from '@/server/auth';
import { prisma } from '@/server/db';
import { deleteAccountData, resyncAccount } from '@/server/repositories/account';
import type { OnboardingResult } from '@/server/jobs/onboarding-backfill';

/** Bounded per-game achievement fan-out on the interactive re-sync path. */
const ACHIEVEMENT_RESYNC_LIMIT = 20;

// Zod schema for the privacy enum — validates input before any DB write.
const PrivacySchema = z.enum(['public', 'friendsOnly', 'private']);

// ---------------------------------------------------------------------------
// setPrivacy
// ---------------------------------------------------------------------------

/**
 * Updates the authenticated user's profile visibility setting.
 *
 * Validates the level against the Privacy enum before writing. Only the
 * session user's own row is ever updated — the steamId comes from the session,
 * never from caller-supplied input.
 *
 * @throws Error if no session user (unauthenticated).
 * @throws ZodError if level is not a valid Privacy value.
 */
export async function setPrivacy(level: 'public' | 'friendsOnly' | 'private'): Promise<void> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new Error('Unauthenticated: no session user found');
  }

  // Validate with zod — rejects any value not in the enum
  const validatedLevel = PrivacySchema.parse(level);

  await prisma.user.update({
    where: { steamId: sessionUser.steamId },
    data: { privacy: validatedLevel },
  });

  revalidatePath('/settings');
}

// ---------------------------------------------------------------------------
// resyncNow
// ---------------------------------------------------------------------------

/**
 * Re-runs the onboarding backfill for the authenticated user, bypassing the
 * onboardedAt early-return guard. Re-fetches profile/games and refreshes
 * today's snapshot. Idempotent via upsert + day-key.
 *
 * @throws Error if no session user (unauthenticated).
 */
export async function resyncNow(): Promise<OnboardingResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new Error('Unauthenticated: no session user found');
  }

  const result = await resyncAccount(sessionUser.steamId, ACHIEVEMENT_RESYNC_LIMIT);

  revalidatePath('/settings');
  return result;
}

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

/**
 * Deletes ALL data for the authenticated user (atomically), then redirects
 * to '/' so the expired session is abandoned.
 *
 * The client-side confirm step (type-to-confirm or checkbox) must fire before
 * invoking this action. The action itself performs no further confirmation.
 *
 * Because we use JWT sessions (ADR §2), there is no DB Session row to delete.
 * The JWT cookie expires naturally or is overwritten when the user next visits.
 * The caller (DeleteAccountForm) calls next-auth signOut after this redirect
 * to clear the cookie client-side.
 *
 * @throws Error if no session user (unauthenticated).
 */
export async function deleteAccount(): Promise<void> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new Error('Unauthenticated: no session user found');
  }

  await deleteAccountData(sessionUser.steamId);

  // No redirect here: the caller (DeleteAccountForm) calls next-auth signOut
  // after this resolves, which clears the JWT cookie AND navigates to '/'. A
  // server-side redirect() would throw NEXT_REDIRECT and pre-empt that, leaving
  // a stale JWT for a now-deleted account.
}
