import { topGamesByPlaytime } from '@/lib/games/select';
import { isSteamApiError } from '@/lib/steam/errors';
import { GameTile } from '@/components/games/GameTile';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { getProfile } from '@/server/repositories/profile';

// The homepage reads env + live Steam data per request — never prerender it at build.
export const dynamic = 'force-dynamic';

const SHELL = 'mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8';

export default async function HomePage() {
  let profile;
  let games;
  let stale = false;

  try {
    const data = await getProfile();
    profile = data.profile;
    games = data.games;
    stale = data.stale;
  } catch (error) {
    // Degrade gracefully on a private library — show a designed empty state, not a crash.
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

  const topGames = topGamesByPlaytime(games, 10);

  return (
    <main className={SHELL}>
      {stale ? <StaleBanner className="mb-6" /> : null}

      <ProfileHeader
        personaName={profile.personaName}
        avatarUrl={profile.avatar.full}
        profileUrl={profile.profileUrl}
        countryCode={profile.countryCode}
      />

      <section className="mt-8">
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
