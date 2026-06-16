import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { OldestUnplayed } from '@/lib/games/backlog';

export interface BacklogCardProps {
  untouchedCount: number;
  librarySize: number;
  /** Oldest unplayed game from {@link oldestUnplayed}. Optional so existing call sites remain valid. */
  oldestUnplayed?: OldestUnplayed | null;
}

/** Format an ISO date string (YYYY-MM-DD) as e.g. "Mar 2021" using UTC. */
function formatAcquiredAt(acquiredAt: string): string {
  const date = new Date(acquiredAt + 'T00:00:00Z');
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function BacklogCard({
  untouchedCount,
  librarySize,
  oldestUnplayed,
}: BacklogCardProps): JSX.Element {
  const pct = librarySize > 0 ? Math.round((untouchedCount / librarySize) * 100) : 0;
  const isEmpty = untouchedCount === 0;

  return (
    <section className="rounded-lg border border-border bg-surface p-6 relative overflow-hidden">
      {/* Label */}
      <p className="text-caption font-medium uppercase tracking-widest text-text-3">The backlog</p>

      {/* Big number row */}
      <div className="flex items-baseline gap-2 mt-3">
        <span className="font-serif text-numeral tabular-nums text-text-1 leading-none">
          {untouchedCount.toLocaleString()}
        </span>
        {!isEmpty && <span className="font-serif text-stat italic text-text-3">games waiting</span>}
      </div>

      {/* Body sentence */}
      <p className="font-serif text-h3 text-text-2 leading-relaxed mt-3">
        {isEmpty ? (
          "You've started every game you own. Nothing waiting on the shelf."
        ) : (
          <>
            That&apos;s <span className="text-brand-500 font-mono not-italic">{pct}%</span> of your
            library you haven&apos;t started yet.
          </>
        )}
      </p>

      {/* Footer: oldest unplayed + CTA */}
      {!isEmpty && (
        <div className="mt-5 pt-5 border-t border-border space-y-4">
          {/* Oldest unplayed callout — only when the prop is provided */}
          {oldestUnplayed != null && (
            <div className="flex flex-col gap-0.5">
              <p className="text-caption font-medium uppercase tracking-widest text-text-3">
                Oldest unplayed
              </p>
              <p className="text-h3 font-serif text-text-1 truncate" title={oldestUnplayed.name}>
                {oldestUnplayed.name}
              </p>
              <p className="text-caption text-text-3">
                {oldestUnplayed.acquiredAt != null
                  ? `Added ${formatAcquiredAt(oldestUnplayed.acquiredAt)}`
                  : 'Date unknown'}
              </p>
            </div>
          )}

          <Link
            href="/library?status=untouched"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3.5 py-2 text-body font-medium text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Browse the backlog
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
