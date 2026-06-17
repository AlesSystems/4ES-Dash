/**
 * Suspense skeleton for /insights/idle.
 * Geometry mirrors the page layout to prevent CLS.
 */

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function IdleLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading idle detection">
      {/* Heading skeleton */}
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Caveat banner skeleton */}
      <div className="mb-6 h-14 animate-pulse rounded-lg bg-surface-2" />

      {/* Flags list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 rounded-lg border border-border bg-surface px-4 py-4"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-36 animate-pulse rounded bg-surface-2" />
            </div>
            <div className="h-8 w-20 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </main>
  );
}
