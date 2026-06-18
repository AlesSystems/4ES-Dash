/**
 * Idle spike detection page — /insights/idle
 *
 * RSC. Lists games with unusual playtime spikes between consecutive snapshots.
 * NEVER asserts cheating — copy says "unusual playtime spike detected" with a
 * heuristic caveat. Each flag has a Dismiss button (client island).
 */

import { getIdleFlags } from '@/server/repositories/insights/idle';
import { EmptyState } from '@/components/states/EmptyState';
import { DismissFlagButton } from '@/components/insights/DismissFlagButton';
import { formatHours } from '@/lib/format/playtime';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Idle Detection',
  description: 'Identify Steam games with unusual playtime spikes that may indicate idle farming.',
};

export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

/** Format a date range as "Jan 1 – Jan 3, 2025". */
function formatDateRange(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const fromStr = from.toLocaleDateString(undefined, opts);
  const toStr = to.toLocaleDateString(undefined, { ...opts, year: 'numeric' });
  return `${fromStr} – ${toStr}`;
}

export default async function IdlePage() {
  const flags = await getIdleFlags();

  return (
    <main className={SHELL}>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-text-1">Idle detection</h1>
        <p className="mt-1 text-sm text-text-3">
          Games with unusual playtime spikes between daily snapshots.
        </p>
      </div>

      {/* Heuristic caveat — always visible */}
      <div className="mb-6 rounded-lg border border-border bg-surface-2 px-4 py-3">
        <p className="text-sm text-text-2">
          <strong className="font-medium text-text-1">Heuristic only:</strong> An unusual playtime
          spike may indicate a game was left running idle, but this is not a guarantee. Many
          legitimate play sessions can trigger this flag.
        </p>
      </div>

      {flags.length === 0 ? (
        <EmptyState
          title="No unusual spikes detected"
          description="All your playtime increments look normal. Keep playing!"
        />
      ) : (
        <section aria-labelledby="idle-flags-heading">
          <h2 id="idle-flags-heading" className="mb-4 text-h2 font-semibold text-text-1">
            Flagged sessions
          </h2>

          <ul className="space-y-3">
            {flags.map((flag) => {
              const fromIso = flag.fromDate.toISOString();
              const toIso = flag.toDate.toISOString();

              return (
                <li
                  key={`${flag.appId}-${fromIso}-${toIso}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    {/* Game name + spike label */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-text-1">{flag.name}</span>
                      <span className="rounded bg-warning/10 px-1.5 py-0.5 font-mono text-caption text-warning">
                        unusual playtime spike detected
                      </span>
                    </div>

                    {/* Date range + delta */}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-3">
                      <span>{formatDateRange(flag.fromDate, flag.toDate)}</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono tabular-nums text-text-2">
                        +{formatHours(flag.deltaMinutes)}
                      </span>
                    </div>
                  </div>

                  {/* Dismiss button — client island */}
                  <DismissFlagButton appId={flag.appId} fromDate={fromIso} toDate={toIso} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
