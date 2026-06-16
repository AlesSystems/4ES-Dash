/**
 * Suspense skeleton for the history page.
 * Geometry mirrors app/history/page.tsx to prevent layout shift (CLS ≈ 0).
 */

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function HistoryLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading playtime history">
      {/* Page heading skeleton */}
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Toggle skeleton */}
      <div className="mb-4 h-9 w-36 animate-pulse rounded-lg bg-surface-2" />

      {/* Chart card skeleton — height matches the h-72 chart + card padding */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="h-72 w-full animate-pulse rounded-lg bg-surface-2" />
      </div>
    </main>
  );
}
