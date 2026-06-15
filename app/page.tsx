import { topGamesByPlaytime } from '@/lib/games/select';
import { isSteamApiError } from '@/lib/steam/errors';
import { GameTile } from '@/components/games/GameTile';
import { RecentlyPlayed } from '@/components/dashboard/RecentlyPlayed';
import { AchievementSummary } from '@/components/dashboard/AchievementSummary';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { getProfile } from '@/server/repositories/profile';
import { getRecentlyPlayed } from '@/server/repositories/recently-played';
import { getAchievementProgress } from '@/server/repositories/achievements';

// The dashboard reads env + live Steam data per request — never prerender it at build.
export const dynamic = 'force-dynamic';

const SHELL = 'mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8';

export default async function HomePage() {
  // Profile gates the page: a private library degrades to a designed empty state.
  let games;
  let profileStale = false;
  try {
    const data = await getProfile();
    games = data.games;
    profileStale = data.stale;
  } catch (error) {
    if (isSteamApiError(error) && error.kind === 'private') {
      return (
        <main className={SHELL}>
          <EmptyState
            title="Profile is private"
            description="Make your Steam profile and game details public to see your library here."
          />
        </main>
      );
    }
    throw error; // anything else is surfaced by app/error.tsx
  }

  // Achievement aggregate runs over owned games that expose achievements.
  const achievementAppIds = games.filter((g) => g.hasAchievements).map((g) => g.appId);

  const [recent, achievements] = await Promise.all([
    getRecentlyPlayed(),
    getAchievementProgress(achievementAppIds),
  ]);

  const topGames = topGamesByPlaytime(games, 10);
  const stale = profileStale || recent.stale;

  return (
    <main className={`${SHELL} space-y-10`}>
      <h1 className="sr-only">Dashboard</h1>
      {stale ? <StaleBanner /> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <RecentlyPlayed games={recent.games} stale={recent.stale} />
        </section>
        <section>
          <AchievementSummary result={achievements} />
        </section>
      </div>

      <section>
        <h2 className="mb-4 text-h3 font-semibold text-text-1">Top games by playtime</h2>
        {topGames.length === 0 ? (
          <EmptyState
            title="No games yet"
            description="This library doesn't have any games to show."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {topGames.map((game) => (
              <li key={game.appId}>
                <GameTile
                  name={game.name}
                  headerUrl={game.headerUrl}
                  playtimeMinutes={game.playtime.total}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
