// Suspense fallback for the library page.
// Geometry mirrors app/library/page.tsx to avoid layout shift (no CLS).
const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function LibraryLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading your game library">
      {/* Header skeleton — title + stat line + stat strip */}
      <div className="mb-6">
        <div className="h-12 w-64 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-surface-2" />
        <div className="mt-4 flex gap-7 border-t border-border pt-4">
          <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-28 animate-pulse rounded bg-surface-2" />
        </div>
      </div>

      {/* Controls bar skeleton — mirrors LibraryControls geometry */}
      <div className="flex flex-col gap-3 border-y border-border py-3.5 lg:flex-row lg:items-center">
        <div className="h-10 w-full animate-pulse rounded-md bg-surface-2 lg:w-80" />
        <div className="flex flex-1 gap-2">
          <div className="h-8 w-16 animate-pulse rounded-full bg-surface-2" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-surface-2" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-surface-2" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-surface-2" />
        <div className="h-10 w-20 animate-pulse rounded-md bg-surface-2" />
      </div>

      {/* Game grid skeleton — 12 cards mirroring LibraryResults grid */}
      <ul className="mt-6 grid grid-cols-2 gap-[18px] sm:grid-cols-3 xl:grid-cols-4">
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
