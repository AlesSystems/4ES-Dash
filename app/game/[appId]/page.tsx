/**
 * Game detail page — /game/[appId]
 *
 * Async RSC that fans out data fetches across independent sections:
 *   1. getProfile()  — gating fetch for hero (name, headerUrl, playtime)
 *   2. GameAchievementsSection — async subcomponent (its own Suspense boundary)
 *   3. GameStoreSection        — async subcomponent (its own Suspense boundary)
 *
 * Sections 2 and 3 are fully independent of each other and stream in
 * separately, each with a geometry-matched skeleton fallback for zero CLS.
 *
 * Degradation:
 *   - Private profile on getProfile() → hero falls back (no crash)
 *   - !achievements.available         → AchievementList renders UnavailableState
 *   - !metadata.available             → StoreMetaPanel renders subtle notice
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isSteamApiError } from '@/lib/steam/errors';
import { getProfile } from '@/server/repositories/profile';
import { getGameStoreMetadata } from '@/server/repositories/store';

import { GameHero } from '@/components/game/GameHero';
import { GameAchievementsSection } from '@/components/game/GameAchievementsSection';
import { GameStoreSection } from '@/components/game/GameStoreSection';
import { GameAchievementsSkeleton, GameStoreSkeleton } from '@/components/game/GameDetailSkeletons';

// The page reads live Steam data per request — never prerender at build time.
export const dynamic = 'force-dynamic';

const SHELL = 'mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8';

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: { appId: string };
}): Promise<Metadata> {
  const appIdNum = Number(params.appId);
  if (!Number.isInteger(appIdNum) || appIdNum <= 0) {
    return { title: 'Game not found' };
  }

  // Best-effort: fetch metadata for the title without blocking the page render.
  let gameName: string | undefined;
  try {
    const meta = await getGameStoreMetadata(appIdNum);
    if (meta.available && meta.data.name.length > 0) {
      gameName = meta.data.name;
    }
  } catch {
    // Metadata fetch failure must not crash the page — degrade title.
  }

  return {
    title: gameName ?? `App ${params.appId}`,
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function GameDetailPage({
  params,
}: {
  params: { appId: string };
}): Promise<JSX.Element> {
  // Validate route param — positive integer only.
  const appIdNum = Number(params.appId);
  if (!Number.isInteger(appIdNum) || appIdNum <= 0) {
    notFound();
  }

  // Gating fetch: profile determines hero content (name, header image, playtime).
  // Achievements and store info are fetched by their own async subcomponents.
  const profileResult = await getProfile().catch((err: unknown) => {
    if (isSteamApiError(err) && err.kind === 'private') {
      return null;
    }
    throw err;
  });

  // Find the game in the owned-games list (null if private / not owned).
  const ownedGame =
    profileResult !== null ? (profileResult.games.find((g) => g.appId === appIdNum) ?? null) : null;

  // Derive hero display fields. Prefer owned-game data; when the game is not
  // owned (or the profile is private), fall back to store metadata so the hero
  // shows the real name and image instead of the generic "App {appId}" string.
  // getGameStoreMetadata is cached (7-day TTL) so the extra await is cheap and
  // only executes on the !ownedGame path.
  let name = ownedGame?.name;
  let headerUrl = ownedGame?.headerUrl;

  if (!name || !headerUrl) {
    const meta = await getGameStoreMetadata(appIdNum).catch(() => null);
    if (meta && meta.available) {
      if (!name && meta.data.name.length > 0) name = meta.data.name;
      if (!headerUrl && meta.data.headerImage.length > 0) headerUrl = meta.data.headerImage;
    }
  }

  name = name ?? `App ${params.appId}`;
  headerUrl =
    headerUrl ?? `https://cdn.akamai.steamstatic.com/steam/apps/${params.appId}/header.jpg`;
  const playtimeMinutes = ownedGame?.playtime.total ?? 0;

  return (
    <main className={SHELL}>
      {/* Hero: game name, cover, playtime — rendered immediately from profile */}
      <GameHero name={name} headerUrl={headerUrl} playtimeMinutes={playtimeMinutes} />

      {/* Two-column layout: achievements (wider) + store info (sidebar).
          Each section fetches independently and streams in behind its own
          geometry-matched skeleton fallback (zero CLS). */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Achievements — independent Steam call, streams in separately */}
        <Suspense fallback={<GameAchievementsSkeleton />}>
          <GameAchievementsSection appId={appIdNum} />
        </Suspense>

        {/* Store metadata + price — independent Steam call, streams in separately */}
        <Suspense fallback={<GameStoreSkeleton />}>
          <GameStoreSection appId={appIdNum} />
        </Suspense>
      </div>
    </main>
  );
}
