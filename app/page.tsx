import { Suspense } from 'react';
import { topGamesByPlaytime } from '@/lib/games/select';
import { oldestUnplayed } from '@/lib/games/backlog';
import { accountAgeYears } from '@/lib/format/account';
import { isSteamApiError } from '@/lib/steam/errors';
import { ProfileStrip } from '@/components/dashboard/ProfileStrip';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { RecentlyPlayed } from '@/components/dashboard/RecentlyPlayed';
import { TopGames } from '@/components/dashboard/TopGames';
import { BacklogCard } from '@/components/dashboard/BacklogCard';
import {
  LibraryValueSection,
  LibraryValueSkeleton,
} from '@/components/dashboard/LibraryValueSection';
import {
  AchievementSummarySection,
  AchievementSummarySkeleton,
} from '@/components/dashboard/AchievementSummarySection';
import {
  AchievementKpiSection,
  AchievementKpiSkeleton,
} from '@/components/dashboard/AchievementKpiSection';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { Landing } from '@/components/marketing/Landing';
import { getProfile } from '@/server/repositories/profile';
import { getLevel } from '@/server/repositories/level';
import { getRecentlyPlayed } from '@/server/repositories/recently-played';
import { getFirstSeenDates } from '@/server/repositories/snapshots';
import { getViewerSteamId } from '@/server/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Your personal Steam dashboard — playtime, achievements, library value, and recently played games at a glance.',
};

// The dashboard reads env + live Steam data per request — never prerender it at build.
export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default async function HomePage() {
  // Resolve the viewer's steamId: authenticated session user, else the dev
  // / featured-profile fallback (env.STEAM_ID). See server/auth.ts.
  const featuredId = await getViewerSteamId();

  // No session AND no featured fallback → logged-out landing (the public face).
  if (!featuredId) {
    return <Landing />;
  }

  // Profile gates the page: a private library degrades to a designed empty state.
  let profile;
  let games;
  let profileStale = false;
  try {
    const data = await getProfile(featuredId);
    profile = data.profile;
    games = data.games;
    profileStale = data.stale;
  } catch (error) {
    if (isSteamApiError(error) && error.kind === 'private') {
      return (
        <main className={SHELL}>
          <h1 className="sr-only">Dashboard</h1>
          <EmptyState
            title="Profile is private"
            description="Make your Steam profile and game details public to see your library here."
          />
        </main>
      );
    }
    throw error; // anything else is surfaced by app/error.tsx
  }

  // Achievement aggregate runs over the most-played games that expose
  // achievements — not the whole library. Each game costs up to 3 rate-limited
  // Steam calls (≈250 ms each), so aggregating all of them blows the dashboard's
  // load budget (~38 s cold for a 50-game library). Bounding to the top N keeps
  // the glanceable summary fast; the cache warms over time. See ERR-0003. The
  // aggregate is NOT awaited here — it streams in its own <Suspense> boundary
  // (AchievementSummarySection) so it never blocks first paint (#85).
  const ACHIEVEMENT_SUMMARY_GAME_LIMIT = 20;
  const achievementAppIds = topGamesByPlaytime(
    games.filter((g) => g.hasAchievements),
    ACHIEVEMENT_SUMMARY_GAME_LIMIT,
  ).map((g) => g.appId);

  const [level, recent, firstSeen] = await Promise.all([
    getLevel(featuredId).catch(() => ({ level: null, stale: false })),
    getRecentlyPlayed(featuredId),
    // Inferred acquiredAt for the backlog's "oldest unplayed" (#28). Degrades to
    // no dates if the snapshot table is empty or unreadable — never blocks.
    getFirstSeenDates(featuredId).catch(() => new Map<number, string>()),
  ]);

  const topGames = topGamesByPlaytime(games, 5).map((g) => ({
    appId: g.appId,
    name: g.name,
    playtimeMinutes: g.playtime.total,
  }));
  const totalPlaytimeMinutes = games.reduce((sum, g) => sum + g.playtime.total, 0);
  const untouchedCount = games.filter((g) => g.playtime.total === 0).length;
  const stale = profileStale || recent.stale;

  // Oldest unplayed game by inferred acquiredAt (#28).
  const gamesWithAcquisition = games.map((g) => ({
    ...g,
    acquiredAt: firstSeen.get(g.appId) ?? null,
  }));
  const oldestUnplayedGame = oldestUnplayed(gamesWithAcquisition);

  return (
    <main className={SHELL}>
      <ProfileStrip
        personaName={profile.personaName}
        avatarUrl={profile.avatar.full}
        level={level.level}
        accountAgeYears={accountAgeYears(profile.createdAt)}
        gamesCount={games.length}
        totalPlaytimeMinutes={totalPlaytimeMinutes}
        recentlyPlayedCount={recent.games.length}
      />

      {stale ? <StaleBanner className="mb-6" /> : null}

      {/* The Achievements KPI tile streams in its own Suspense boundary so it
          never blocks first paint. Both this tile and AchievementSummarySection
          below call getAchievementProgress — the cache single-flight map
          (server/cache.ts inFlight) collapses the two into one Steam fan-out
          per render. See plan-01 decision note. */}
      <KpiRow
        totalPlaytimeMinutes={totalPlaytimeMinutes}
        librarySize={games.length}
        recentlyPlayedCount={recent.games.length}
        achievements={
          <Suspense fallback={<AchievementKpiSkeleton />}>
            <AchievementKpiSection steamId={featuredId} appIds={achievementAppIds} />
          </Suspense>
        }
      />

      <div className="mb-8">
        <RecentlyPlayed games={recent.games} stale={recent.stale} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <TopGames games={topGames} />
        </section>
        <div className="flex flex-col gap-6">
          <BacklogCard
            untouchedCount={untouchedCount}
            librarySize={games.length}
            oldestUnplayed={oldestUnplayedGame}
          />
          <Suspense fallback={<LibraryValueSkeleton />}>
            <LibraryValueSection steamId={featuredId} />
          </Suspense>
          <Suspense fallback={<AchievementSummarySkeleton />}>
            <AchievementSummarySection steamId={featuredId} appIds={achievementAppIds} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
