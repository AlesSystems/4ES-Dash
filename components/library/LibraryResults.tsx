'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LibraryGame, ViewMode } from '@/lib/games/sort';
import { GameCard } from './GameCard';
import { GameRow } from './GameRow';

export interface LibraryResultsProps {
  games: LibraryGame[];
  view: ViewMode;
  /** When true playtime is hidden by Steam privacy — passed to each game tile. */
  playtimeHidden?: boolean;
}

const PAGE_SIZE = 24;

/**
 * Results area for the library — switches between grid and list and reveals
 * more games client-side (no extra fetch; the full filtered list is already on
 * the page). Remount via the page's `key` resets pagination when filters change.
 */
export function LibraryResults({
  games,
  view,
  playtimeHidden = false,
}: LibraryResultsProps): JSX.Element {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = games.slice(0, visible);
  const remaining = games.length - shown.length;

  return (
    <div>
      {view === 'list' ? (
        <ul
          className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
          role="list"
        >
          {shown.map((game) => (
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
          {shown.map((game) => (
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
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="inline-flex items-center gap-2 rounded-full border border-border-2 bg-surface px-5 py-2.5 text-body font-medium text-text-1 transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Load {Math.min(PAGE_SIZE, remaining)} more
            <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
          </button>
          <span className="font-mono text-caption tabular-nums text-text-3">
            {shown.length} of {games.length} · {remaining} remaining
          </span>
        </div>
      )}
    </div>
  );
}
