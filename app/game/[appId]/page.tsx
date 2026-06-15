/**
 * Game detail page — /game/[appId]
 *
 * Async RSC that fans out four data fetches in parallel:
 *   1. getProfile()            — find the owned game (name, headerUrl, playtime)
 *   2. getGameAchievements()   — per-game achievement list
 *   3. getGameStoreMetadata()  — store description / genres / etc.
 *   4. getGameStorePrice()     — current store price
 *
 * All four degrade gracefully (acceptance criteria, Phase 1):
 *   - Private profile on getProfile() → no crash; playtime falls back to 0
 *   - !achievements.available         → AchievementList renders UnavailableState
 *   - !metadata.available             → StoreMetaPanel renders subtle notice
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isSteamApiError } from '@/lib/steam/errors';
import { getProfile } from '@/server/repositories/profile';
import { getGameAchievements } from '@/server/repositories/achievements';
import { getGameStoreMetadata, getGameStorePrice } from '@/server/repositories/store';

import { GameHero } from '@/components/game/GameHero';
import { AchievementList } from '@/components/game/AchievementList';
import { StoreMetaPanel } from '@/components/game/StoreMetaPanel';

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

  // Fan out all four fetches in parallel.
  const [profileResult, achievements, metadata, price] = await Promise.all([
    // getProfile may throw SteamApiError('private') — catch and degrade.
    getProfile().catch((err: unknown) => {
      if (isSteamApiError(err) && err.kind === 'private') {
        return null;
      }
      throw err;
    }),
    getGameAchievements(appIdNum),
    getGameStoreMetadata(appIdNum),
    getGameStorePrice(appIdNum),
  ]);

  // Find the game in the owned-games list (null if private / not owned).
  const ownedGame =
    profileResult !== null ? (profileResult.games.find((g) => g.appId === appIdNum) ?? null) : null;

  // Derive display fields — prefer profile data, fall back through metadata.
  const name =
    ownedGame?.name ??
    (metadata.available && metadata.data.name.length > 0
      ? metadata.data.name
      : `App ${params.appId}`);

  const headerUrl =
    ownedGame?.headerUrl ??
    (metadata.available && metadata.data.headerImage.length > 0
      ? metadata.data.headerImage
      : `https://cdn.akamai.steamstatic.com/steam/apps/${params.appId}/header.jpg`);

  const playtimeMinutes = ownedGame?.playtime.total ?? 0;

  return (
    <main className={SHELL}>
      {/* Hero: game name, cover, playtime */}
      <GameHero name={name} headerUrl={headerUrl} playtimeMinutes={playtimeMinutes} />

      {/* Two-column layout: achievements (wider) + store info (sidebar) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Achievements — full degradation handled inside component */}
        <AchievementList result={achievements} />

        {/* Store metadata + price — degrades to subtle notice inside component */}
        <StoreMetaPanel metadata={metadata} price={price} />
      </div>
    </main>
  );
}
