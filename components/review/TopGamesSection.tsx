/**
 * Top-5 games section for the Year in Review page.
 *
 * Shows the games with the most playtime gained in the year, ranked 1–5.
 * Playtime delta is formatted as hours. Empty-safe (renders nothing when
 * topGames is empty).
 */

import { formatHours } from '@/lib/format/playtime';
import type { TopGame } from '@/lib/insights/year-in-review';

interface TopGamesSectionProps {
  topGames: TopGame[];
}

export function TopGamesSection({ topGames }: TopGamesSectionProps): JSX.Element | null {
  if (topGames.length === 0) return null;

  return (
    <section aria-labelledby="top-games-heading">
      <p
        id="top-games-heading"
        className="font-mono text-caption uppercase tracking-widest text-text-3"
      >
        Top games
      </p>

      <ol className="mt-4 space-y-2" role="list">
        {topGames.map((game, index) => (
          <li
            key={game.appId}
            className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3"
          >
            {/* Rank number */}
            <span
              className="w-5 shrink-0 font-mono text-caption tabular-nums text-text-3"
              aria-label={`Rank ${index + 1}`}
            >
              {index + 1}
            </span>

            {/* Game name */}
            <span className="min-w-0 flex-1 truncate text-body font-medium text-text-1">
              {game.name}
            </span>

            {/* Playtime delta */}
            <span className="shrink-0 font-mono text-caption tabular-nums text-text-2">
              {formatHours(game.minutesDelta)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
