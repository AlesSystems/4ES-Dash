import { isSteamApiError } from '@/lib/steam/errors';
import {
  parseSortKey,
  parseStatusKey,
  parseViewMode,
  sortGames,
  filterGames,
  filterByStatus,
  type LibraryGame,
} from '@/lib/games/sort';
import { accountAgeYears } from '@/lib/format/account';
import { getProfile } from '@/server/repositories/profile';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { LibraryHeader } from '@/components/library/LibraryHeader';
import { LibraryControls } from '@/components/library/LibraryControls';
import { LibraryResults } from '@/components/library/LibraryResults';
import { LibraryEmpty } from '@/components/library/LibraryEmpty';

// Reads env + live Steam data per request — never prerender at build time.
export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

interface LibraryPageProps {
  searchParams: { sort?: string; q?: string; status?: string; view?: string };
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  let profile;
  let games;
  let stale = false;

  try {
    const data = await getProfile();
    profile = data.profile;
    games = data.games;
    stale = data.stale;
  } catch (error) {
    if (isSteamApiError(error) && error.kind === 'private') {
      return (
        <main className={SHELL}>
          <h1 className="sr-only">Library</h1>
          <EmptyState
            title="Profile is private"
            description="Make your Steam profile and game details public to see your library here."
          />
        </main>
      );
    }
    throw error;
  }

  const sort = parseSortKey(searchParams.sort);
  const status = parseStatusKey(searchParams.status);
  const view = parseViewMode(searchParams.view);
  const q = searchParams.q ?? '';

  const shown = sortGames(filterByStatus(filterGames(games, q), status), sort);

  // Show the inferred-date note whenever sort=added is active and ANY game still
  // lacks an acquiredAt. In Phase 1 no game has a date yet, so this is always
  // true; it stays correct once the snapshot job (Phase 2) backfills some dates.
  const addedUnavailable = (games as LibraryGame[]).some((g) => (g.acquiredAt ?? null) === null);

  const inProgressCount = games.filter((g) => g.playtime.total > 0).length;
  const untouchedCount = games.filter((g) => g.playtime.total === 0).length;
  const totalPlaytimeMinutes = games.reduce((sum, g) => sum + g.playtime.total, 0);

  return (
    <main className={SHELL}>
      <LibraryHeader
        accountAgeYears={accountAgeYears(profile.createdAt)}
        gamesCount={games.length}
        totalPlaytimeMinutes={totalPlaytimeMinutes}
        inProgressCount={inProgressCount}
        untouchedCount={untouchedCount}
      />

      {stale ? <StaleBanner className="mb-4" /> : null}

      <LibraryControls
        sort={sort}
        query={q}
        status={status}
        view={view}
        total={games.length}
        shown={shown.length}
        addedUnavailable={addedUnavailable}
      />

      <div className="mt-6">
        {shown.length === 0 ? (
          games.length === 0 ? (
            <EmptyState title="No games yet" description="This library has no games to show." />
          ) : (
            <LibraryEmpty total={games.length} query={q.length > 0 ? q : undefined} />
          )
        ) : (
          <LibraryResults key={`${status}-${sort}-${q}`} games={shown} view={view} />
        )}
      </div>
    </main>
  );
}
