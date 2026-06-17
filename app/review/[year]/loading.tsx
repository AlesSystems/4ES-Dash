/**
 * Suspense skeleton for /review/[year].
 * Geometry mirrors the page layout to prevent CLS.
 */

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function ReviewLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading Year in Review">
      {/* Eyebrow skeleton */}
      <div className="mb-10">
        <div className="h-3 w-28 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Year glyph skeleton */}
      <div className="mb-6 flex justify-center">
        <div className="h-32 w-72 animate-pulse rounded-lg bg-surface-2" />
      </div>

      {/* Total hours skeleton */}
      <div className="mb-16 flex items-baseline gap-3">
        <div className="h-14 w-36 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-7 w-20 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Top games section skeleton */}
      <div className="mb-10">
        <div className="mb-4 h-3 w-24 animate-pulse rounded bg-surface-2" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
            >
              <div className="h-4 w-4 animate-pulse rounded bg-surface-2" />
              <div className="flex-1">
                <div className="h-4 w-48 animate-pulse rounded bg-surface-2" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Achievements skeleton */}
      <div>
        <div className="mb-4 h-3 w-24 animate-pulse rounded bg-surface-2" />
        <div className="flex items-baseline gap-3">
          <div className="h-14 w-24 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-7 w-20 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    </main>
  );
}
