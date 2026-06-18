/**
 * Public profile route — /u/<steamId>
 *
 * Renders PUBLIC Steam data for any visitor, gated by the authorization layer
 * (server/authz.ts). The viewer may be anonymous or any signed-in user.
 *
 *  - Invalid steamId param        → notFound().
 *  - Not allowed (canViewProfile) → designed locked state, NO target data fetched.
 *  - Allowed but Steam profile is private → same locked state (degrade, never throw).
 *  - Allowed + public Steam data  → rendered.
 *
 * This is the IDOR boundary: a viewer can never see another user's private /
 * derived data — canViewProfile decides before any data is fetched.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Privacy } from '@prisma/client';
import { prisma } from '@/server/db';
import { getSessionUser } from '@/server/auth';
import { canViewProfile } from '@/server/authz';
import { getProfile } from '@/server/repositories/profile';
import { isValidSteamId } from '@/lib/compare/steam-id';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { EmptyState } from '@/components/states/EmptyState';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'A public Steam profile on 4ES Dash.',
};

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

interface PublicProfilePageProps {
  params: { steamId: string };
}

function LockedProfile(): JSX.Element {
  return (
    <main className={SHELL}>
      <EmptyState
        title="This profile is private"
        description="The owner has not made this dashboard public."
      />
    </main>
  );
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps): Promise<JSX.Element> {
  const { steamId } = params;
  if (!isValidSteamId(steamId)) {
    notFound();
  }

  // Resolve the viewer (may be anonymous) and the target's privacy level.
  const viewer = await getSessionUser();
  const user = await prisma.user.findUnique({
    where: { steamId },
    select: { privacy: true },
  });
  const privacy: Privacy = user?.privacy ?? 'public';

  // Authorization gate — decided BEFORE any of the target's data is fetched.
  const allowed = await canViewProfile(viewer?.steamId ?? null, { steamId, privacy });
  if (!allowed) {
    return <LockedProfile />;
  }

  // Allowed: fetch public Steam data. A private Steam profile degrades to the
  // same locked state — never a thrown error to the user.
  let personaName: string;
  let avatarUrl: string;
  let profileUrl: string | undefined;
  let gamesCount: number;
  try {
    const data = await getProfile(steamId);
    personaName = data.profile.personaName;
    avatarUrl = data.profile.avatar.medium;
    profileUrl = data.profile.profileUrl;
    gamesCount = data.games.length;
  } catch {
    // SteamApiError (kind: 'private' | ...) or any failure → locked/empty state.
    return <LockedProfile />;
  }

  return (
    <main className={SHELL}>
      <ProfileHeader personaName={personaName} avatarUrl={avatarUrl} profileUrl={profileUrl} />
      <p className="mt-6 text-body text-text-2 tabular-nums">
        <span className="font-medium text-text-1">{gamesCount}</span> games in library
      </p>
    </main>
  );
}
