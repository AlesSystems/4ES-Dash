/**
 * Suspense skeleton for /insights/cost-per-hour.
 * Geometry mirrors the page layout to prevent CLS.
 */

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function CostPerHourLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading cost per hour">
      {/* Heading skeleton */}
      <div className="mb-6">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Disclaimer banner skeleton */}
      <div className="mb-6 h-12 animate-pulse rounded-lg bg-surface-2" />

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {/* Table header skeleton */}
        <div className="flex gap-4 border-b border-border bg-surface-2 px-4 py-2.5">
          <div className="h-3 flex-1 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
          >
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-12 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-14 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-14 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </main>
  );
}
