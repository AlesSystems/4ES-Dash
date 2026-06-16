import type { LibraryValue } from '@/server/repositories/library-value';

export interface LibraryValueCardProps {
  value: LibraryValue;
}

/**
 * Dashboard card that shows the total current store value of the user's library
 * (sum of price_overview.final across all priced games, issue #29).
 *
 * Server component — no client state needed.
 * Price-paid note is always rendered; no vs-paid field is shown (Steam doesn't
 * expose purchase prices).
 */
export function LibraryValueCard({ value }: LibraryValueCardProps): JSX.Element {
  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: value.currency || 'USD',
  }).format(value.totalMinor / 100);

  return (
    <section className="rounded-lg border border-border bg-surface p-6 relative overflow-hidden">
      {/* Label */}
      <p className="text-caption font-medium uppercase tracking-widest text-text-3">
        Library value
      </p>

      {/* Big numeral row */}
      <div className="flex items-baseline gap-2 mt-3">
        <span className="font-serif text-numeral tabular-nums text-text-1 leading-none">
          {formatted}
        </span>
      </div>

      {/* Sub-line: game counts */}
      <p className="text-caption text-text-3 mt-1">
        {value.pricedCount.toLocaleString()} game{value.pricedCount !== 1 ? 's' : ''}
        {value.freeCount > 0 && <> &bull; {value.freeCount.toLocaleString()} free</>}
      </p>

      {/* Always-present price-paid disclaimer */}
      <p className="text-caption text-text-3 mt-3 leading-snug">
        Based on current store prices — purchase prices are not available via Steam.
      </p>

      {/* Conditional: some prices unavailable */}
      {value.missingCount > 0 && (
        <p className="text-caption text-text-3 mt-1 opacity-60">
          Some prices unavailable ({value.missingCount.toLocaleString()} game
          {value.missingCount !== 1 ? 's' : ''} excluded).
        </p>
      )}
    </section>
  );
}
