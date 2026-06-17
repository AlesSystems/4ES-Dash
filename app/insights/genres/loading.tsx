/**
 * Suspense skeleton for /insights/genres.
 * Geometry mirrors the page to prevent CLS.
 */

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function GenresLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading genre breakdown">
      {/* Heading skeleton */}
      <div className="mb-6">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Chart skeleton */}
      <div className="h-64 w-full animate-pulse rounded-lg bg-surface-2" />

      {/* Table skeleton */}
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
          >
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-12 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </main>
  );
}
