import { isSteamApiError } from '@/lib/steam/errors';
import {
  parseSortKey,
  sortGames,
  filterGames,
  acquisitionDatesUnavailable,
} from '@/lib/games/sort';
import { getProfile } from '@/server/repositories/profile';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { LibraryControls } from '@/components/library/LibraryControls';
import { LibraryGrid } from '@/components/library/LibraryGrid';

// Reads env + live Steam data per request — never prerender at build time.
export const dynamic = 'force-dynamic';

const SHELL = 'mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8';

interface LibraryPageProps {
  searchParams: { sort?: string; q?: string };
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  let games;
  let stale = false;

  try {
    const data = await getProfile();
    games = data.games;
    stale = data.stale;
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
    throw error;
  }

  const sort = parseSortKey(searchParams.sort);
  const q = searchParams.q ?? '';
  const filtered = filterGames(games, q);
  const shown = sortGames(filtered, sort);
  const addedUnavailable = acquisitionDatesUnavailable(games);

  return (
    <main className={SHELL}>
      <h1 className="mb-6 text-h1 font-semibold text-text-1">Library</h1>

      {stale ? <StaleBanner className="mb-6" /> : null}

      <LibraryControls
        sort={sort}
        query={q}
        total={games.length}
        shown={shown.length}
        addedUnavailable={addedUnavailable}
      />

      <div className="mt-6">
        {shown.length === 0 ? (
          <EmptyState
            title="No games found"
            description={
              q.length > 0
                ? `No games match "${q}". Try a different search.`
                : 'This library has no games to show.'
            }
          />
        ) : (
          <LibraryGrid games={shown} />
        )}
      </div>
    </main>
  );
}
