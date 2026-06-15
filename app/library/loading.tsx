// Suspense fallback for the library page.
// Geometry mirrors app/library/page.tsx to avoid layout shift (no CLS).
const SHELL = 'mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8';

export default function LibraryLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading your game library">
      {/* Page heading skeleton */}
      <div className="mb-6 h-8 w-32 animate-pulse rounded-md bg-surface-2" />

      {/* Controls bar skeleton — mirrors LibraryControls geometry */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search input skeleton */}
          <div className="h-9 w-full animate-pulse rounded-md bg-surface-2 sm:w-56" />
          {/* Sort select skeleton */}
          <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" />
        </div>
        {/* Count skeleton */}
        <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Game grid skeleton — 12 cards mirroring LibraryGrid layout */}
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <li key={i} className="overflow-hidden rounded-lg border border-border bg-surface">
            {/* Cover art: aspect-[2/1] to match GameCard */}
            <div className="aspect-[2/1] w-full animate-pulse bg-surface-2" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
