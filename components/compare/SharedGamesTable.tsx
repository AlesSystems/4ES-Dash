import Image from 'next/image';
import { formatHours } from '@/lib/format/playtime';
import type { SharedGame } from '@/lib/compare/shared-games';

export interface SharedGamesTableProps {
  rows: SharedGame[];
  aName: string;
  bName: string;
}

/**
 * Table of games shared by two compared users.
 *
 * Rows are pre-sorted by |delta| DESC (the repository guarantees order).
 * The delta string format follows the acceptance criteria exactly:
 *   "<aName>: <formatHours(playtimeA)> vs <bName>: <formatHours(playtimeB)> (Δ <formatHours(deltaMinutes)>)"
 */
export function SharedGamesTable({ rows, aName, bName }: SharedGamesTableProps): JSX.Element {
  if (rows.length === 0) {
    return <></>;
  }

  return (
    <div className="mt-6">
      <h2 className="mb-4 font-serif text-h2 font-normal text-text-1">
        Shared <em>games</em>
        <span className="ml-3 font-mono text-caption font-normal not-italic text-text-3">
          · {rows.length} in common
        </span>
      </h2>

      <div
        role="table"
        aria-label="Shared games"
        className="divide-y divide-border overflow-hidden rounded-lg border border-border"
      >
        {/* Header row */}
        <div
          role="row"
          className="grid grid-cols-[40px_1fr_auto] items-center gap-4 bg-surface-2 px-4 py-2"
        >
          <span className="sr-only">Icon</span>
          <span
            role="columnheader"
            className="font-mono text-caption uppercase tracking-widest text-text-3"
          >
            Game
          </span>
          <span
            role="columnheader"
            className="font-mono text-caption uppercase tracking-widest text-text-3"
          >
            Playtime comparison
          </span>
        </div>

        {/* Data rows */}
        {rows.map((row) => (
          <div
            key={row.appId}
            role="row"
            className="grid grid-cols-[40px_1fr_auto] items-center gap-4 bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
          >
            {/* Game icon */}
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-surface-2">
              {row.iconUrl !== null ? (
                <Image
                  src={row.iconUrl}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                  aria-hidden
                />
              ) : (
                <div className="h-full w-full" aria-hidden />
              )}
            </div>

            {/* Game name */}
            <p className="min-w-0 truncate font-serif text-h3 font-medium text-text-1">
              {row.name}
            </p>

            {/* Delta string — exact format per acceptance criteria */}
            <p className="shrink-0 font-mono text-body tabular-nums text-text-2">
              <span className="text-text-1">{aName}</span>
              {': '}
              <span className="tabular-nums">{formatHours(row.playtimeA)}</span>
              {' vs '}
              <span className="text-text-1">{bName}</span>
              {': '}
              <span className="tabular-nums">{formatHours(row.playtimeB)}</span>
              {' (Δ '}
              <span className="tabular-nums text-brand-500">{formatHours(row.deltaMinutes)}</span>
              {')'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
