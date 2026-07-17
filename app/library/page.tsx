import { isSteamApiError } from '@/lib/steam/errors';
import {
  parseLimitParam,
  parseSortKey,
  parseStatusKey,
  parseViewMode,
  sortGames,
  filterGames,
  filterByStatus,
  toLibraryTile,
  type LibraryGame,
} from '@/lib/games/sort';
import { parseMultiplayerParam, filterToMultiplayer } from '@/lib/games/multiplayer';
import { accountAgeYears } from '@/lib/format/account';
import { getProfile } from '@/server/repositories/profile';
import { getFirstSeenDates } from '@/server/repositories/snapshots';
import { getMultiplayerAppIds } from '@/server/repositories/multiplayer';
import { getViewerSteamId } from '@/server/auth';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { LibraryHeader } from '@/components/library/LibraryHeader';
import { LibraryControls } from '@/components/library/LibraryControls';
import { LibraryResults } from '@/components/library/LibraryResults';
import { LibraryEmpty } from '@/components/library/LibraryEmpty';
import { PlaytimeHiddenBanner } from '@/components/library/PlaytimeHiddenBanner';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Library',
  description:
    'Browse, sort, and filter your entire Steam game library by playtime, status, and more.',
};

// Reads env + live Steam data per request — never prerender at build time.
export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

interface LibraryPageProps {
  searchParams: {
    sort?: string;
    q?: string;
    status?: string;
    view?: string;
    multiplayer?: string;
    limit?: string;
  };
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const featuredId = await getViewerSteamId();
  let profile;
  let games: LibraryGame[];
  let stale = false;
  let playtimeHidden = false;

  try {
    const data = await getProfile(featuredId);
    profile = data.profile;
    stale = data.stale;
    playtimeHidden = data.playtimeHidden ?? false;
    // Merge snapshot-inferred acquiredAt (#26) so sort=added lights up for games
    // seen since tracking began. getProfile is cached, so this adds one DB query.
    // Degrade to no dates on a DB hiccup — the library still renders (matches the
    // dashboard; a missing-history read must never crash the page).
    const firstSeen = await getFirstSeenDates(featuredId).catch(() => new Map<number, string>());
    games = data.games.map((g) => ({ ...g, acquiredAt: firstSeen.get(g.appId) ?? null }));
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
  const multiplayer = parseMultiplayerParam(searchParams.multiplayer);
  const limit = parseLimitParam(searchParams.limit);

  // Only fetch multiplayer category data when the filter is active.
  // Cold-cache Store fetches are expensive — do NOT slow the default library view.
  let multiplayerAppIds: Set<number> | null = null;
  let uncategorizedCount = 0;
  if (multiplayer) {
    // On a total repo failure, treat every game as uncategorized so the
    // "Some games could not be categorized" note surfaces instead of a silent
    // empty grid (degrade, never hide — see CLAUDE.md degradation contract).
    const mp = await getMultiplayerAppIds(featuredId).catch(() => ({
      multiplayerAppIds: new Set<number>(),
      missingCount: games.length,
      stale: false,
    }));
    multiplayerAppIds = mp.multiplayerAppIds;
    uncategorizedCount = mp.missingCount;
    stale = stale || mp.stale;
  }

  const base = filterByStatus(filterGames(games, q), status);
  const filtered =
    multiplayer && multiplayerAppIds ? filterToMultiplayer(base, multiplayerAppIds) : base;
  const shown = sortGames(filtered, sort);

  // Show the inferred-date note whenever sort=added is active and ANY game still
  // lacks an acquiredAt — games owned before snapshotting began stay null.
  const addedUnavailable = games.some((g) => (g.acquiredAt ?? null) === null);

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
        playtimeHidden={playtimeHidden}
      />

      {stale ? <StaleBanner className="mb-4" /> : null}
      {playtimeHidden ? <PlaytimeHiddenBanner /> : null}

      <LibraryControls
        sort={sort}
        query={q}
        status={status}
        view={view}
        total={games.length}
        shown={shown.length}
        addedUnavailable={addedUnavailable}
        multiplayer={multiplayer}
        uncategorizedCount={uncategorizedCount}
        playtimeHidden={playtimeHidden}
      />

      <div className="mt-6">
        {shown.length === 0 ? (
          games.length === 0 ? (
            <EmptyState title="No games yet" description="This library has no games to show." />
          ) : (
            <LibraryEmpty total={games.length} query={q.length > 0 ? q : undefined} />
          )
        ) : (
          <LibraryResults
            // Sort/filter above use the full LibraryGame (recent/added need
            // twoWeeks/acquiredAt); only the visible page's tile projection
            // crosses to the client — payload is bounded by ?limit=, and paging
            // is URL state (no remount key: LibraryControls drops `limit` when
            // a set-changing filter key changes).
            games={shown.slice(0, limit).map(toLibraryTile)}
            filteredTotal={shown.length}
            view={view}
            playtimeHidden={playtimeHidden}
          />
        )}
      </div>
    </main>
  );
}
