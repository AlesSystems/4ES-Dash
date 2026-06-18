/**
 * server/authz.ts — Authorization gate for per-user data isolation.
 *
 * Decides whether a viewer (or anonymous) may see a target user's
 * private/derived data. Public Steam data is visible to anyone; this gate
 * controls the private/derived layer.
 *
 * Rules:
 *   - public    → anyone (viewer null, viewer other, owner)
 *   - owner     → always true (regardless of privacy)
 *   - private   → owner only; all others denied
 *   - friendsOnly → true iff viewer is in target's Steam friends list
 *                   (owner shortcut applies first)
 *                   FAIL CLOSED: if friend list is unavailable, private, or
 *                   errors for any reason → false. Never expose data when
 *                   friendship cannot be confirmed.
 *
 * CSRF note: next-auth provides CSRF tokens on all state-changing routes
 * (/api/auth/signin, /api/auth/signout, /api/auth/callback) by default via
 * its built-in CSRF double-submit cookie pattern. No extra CSRF code is
 * needed here for read-only data endpoints.
 *
 * This module is server-only. Never import from client components.
 */

import type { Privacy } from '@prisma/client';
import { getFriendList } from '@/lib/steam/friends';

/**
 * Decides whether `viewer` (or anon=null) may see `target`'s private/derived data.
 *
 * @param viewerSteamId - The steamId of the viewer, or null for unauthenticated.
 * @param target - The target user's steamId and privacy setting.
 * @returns true if the viewer is allowed, false otherwise.
 */
export async function canViewProfile(
  viewerSteamId: string | null,
  target: { steamId: string; privacy: Privacy },
): Promise<boolean> {
  // Owner always sees their own profile, regardless of privacy setting.
  if (viewerSteamId !== null && viewerSteamId === target.steamId) {
    return true;
  }

  // Public profile — anyone can view.
  if (target.privacy === 'public') {
    return true;
  }

  // Private profile — only the owner (handled above); all others denied.
  if (target.privacy === 'private') {
    return false;
  }

  // friendsOnly: viewer must be authenticated AND in the target's friends list.
  // Fail closed on any error (private, transient, schema, unknown).
  if (target.privacy === 'friendsOnly') {
    // Unauthenticated viewer cannot be a friend.
    if (viewerSteamId === null) {
      return false;
    }

    try {
      const friends = await getFriendList(target.steamId);
      return friends.some((f) => f.steamId === viewerSteamId);
    } catch {
      // FAIL CLOSED: any error (private friend list, network, schema) → deny.
      // Never expose data when friendship cannot be confirmed.
      return false;
    }
  }

  // Exhaustive — Privacy enum is public | friendsOnly | private.
  // TypeScript will catch any new enum values that aren't handled above.
  return false;
}
