import type { LibraryTileGame, ViewMode } from '@/lib/games/sort';
import { GameCard } from './GameCard';
import { GameRow } from './GameRow';
import { LoadMoreButton } from './LoadMoreButton';

export interface LibraryResultsProps {
  /**
   * The visible page ONLY — the RSC page slices `shown.slice(0, limit)` and
   * projects with `toLibraryTile` before passing. Nothing beyond the current
   * page crosses the RSC→client boundary.
   */
  games: LibraryTileGame[];
  /**
   * Count of the FILTERED result set (page `shown.length`, computed pre-slice)
   * — NOT the all-games library total. Drives the "X of Y · N remaining" copy;
   * these differ whenever a filter is active.
   */
  filteredTotal: number;
  view: ViewMode;
  /** When true playtime is hidden by Steam privacy — passed to each game tile. */
  playtimeHidden?: boolean;
}

/**
 * Results area for the library — switches between grid and list. A server
 * component: paging is URL state (`?limit=`), so revealing more games is a
 * `router.replace` in the {@link LoadMoreButton} client leaf followed by an
 * RSC re-render with a larger server-side slice. Stays synchronous so jsdom
 * tests can render it directly (ERR-0006).
 */
export function LibraryResults({
  games,
  filteredTotal,
  view,
  playtimeHidden = false,
}: LibraryResultsProps): JSX.Element {
  const remaining = filteredTotal - games.length;

  return (
    <div>
      {view === 'list' ? (
        <ul
          className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
          role="list"
        >
          {games.map((game) => (
            <li key={game.appId}>
              <GameRow
                appId={game.appId}
                name={game.name}
                headerUrl={game.headerUrl}
                playtimeMinutes={game.playtime.total}
                twoWeeksMinutes={game.playtime.twoWeeks}
                playtimeHidden={playtimeHidden}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 xl:grid-cols-4" role="list">
          {games.map((game) => (
            <li key={game.appId}>
              <GameCard
                appId={game.appId}
                name={game.name}
                headerUrl={game.headerUrl}
                playtimeMinutes={game.playtime.total}
                twoWeeksMinutes={game.playtime.twoWeeks}
                hasAchievements={game.hasAchievements}
                playtimeHidden={playtimeHidden}
              />
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <div className="flex flex-col items-center gap-2.5 py-9">
          <LoadMoreButton remaining={remaining} />
          <span className="font-mono text-caption tabular-nums text-text-3">
            {games.length} of {filteredTotal} · {remaining} remaining
          </span>
        </div>
      )}
    </div>
  );
}
