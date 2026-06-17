// Suspense fallback for /compare — geometry mirrors ComparePage to avoid layout shift.
const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function CompareLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading comparison">
      {/* CompareHeader skeleton — two columns + vs divider */}
      <div className="mb-7 flex items-stretch border-y border-border py-6">
        {/* Side A */}
        <div className="flex flex-1 flex-col items-start gap-4">
          <div className="h-20 w-20 animate-pulse rounded-full bg-surface-2" />
          <div className="h-7 w-36 animate-pulse rounded bg-surface-2" />
          <div className="flex gap-6">
            <div className="flex flex-col items-start gap-2">
              <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-12 animate-pulse rounded bg-surface-2" />
            </div>
            <div className="flex flex-col items-start gap-2">
              <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-12 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        </div>

        {/* vs divider */}
        <div className="flex w-20 shrink-0 flex-col items-center justify-center border-x border-border">
          <div className="h-5 w-5 animate-pulse rounded bg-surface-2" />
          <div className="mt-2 h-3 w-12 animate-pulse rounded bg-surface-2" />
        </div>

        {/* Side B */}
        <div className="flex flex-1 flex-col items-end gap-4">
          <div className="h-20 w-20 animate-pulse rounded-full bg-surface-2" />
          <div className="h-7 w-36 animate-pulse rounded bg-surface-2" />
          <div className="flex flex-row-reverse gap-6">
            <div className="flex flex-col items-end gap-2">
              <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-12 animate-pulse rounded bg-surface-2" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="h-5 w-16 animate-pulse rounded bg-surface-2" />
              <div className="h-3 w-12 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        </div>
      </div>

      {/* SharedGamesTable skeleton */}
      <div className="mt-6">
        <div className="mb-4 h-7 w-48 animate-pulse rounded bg-surface-2" />
        <div className="overflow-hidden rounded-lg border border-border">
          {/* header row */}
          <div className="grid grid-cols-[40px_1fr_auto] items-center gap-4 bg-surface-2 px-4 py-2">
            <div />
            <div className="h-3 w-16 animate-pulse rounded bg-surface" />
            <div className="h-3 w-28 animate-pulse rounded bg-surface" />
          </div>
          {/* data rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[40px_1fr_auto] items-center gap-4 border-t border-border bg-surface px-4 py-3"
            >
              <div className="h-10 w-10 animate-pulse rounded-sm bg-surface-2" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
              <div className="h-4 w-64 animate-pulse rounded bg-surface-2" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
