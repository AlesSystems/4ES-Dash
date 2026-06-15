/**
 * loading.tsx — Suspense skeleton for the game detail page.
 *
 * Mirrors the geometry of the hero + two-panel layout so there is no
 * cumulative layout shift (CLS) when the async content arrives.
 */

export default function GameDetailLoading(): JSX.Element {
  return (
    <div className="mx-auto max-w-content animate-pulse px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero skeleton */}
      <div className="mb-8 overflow-hidden rounded-xl border border-border bg-surface">
        {/* Cover image placeholder */}
        <div className="h-48 w-full bg-surface-2 sm:h-64" />
        {/* Title + playtime placeholder */}
        <div className="-mt-20 px-6 pb-6 pt-0">
          <div className="mb-2 h-8 w-2/3 rounded-md bg-surface-2" />
          <div className="h-5 w-32 rounded-md bg-surface-2" />
        </div>
      </div>

      {/* Two-column layout skeleton */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Achievements panel skeleton */}
        <div>
          {/* Heading + count */}
          <div className="mb-4 flex items-baseline gap-3">
            <div className="h-6 w-40 rounded-md bg-surface-2" />
            <div className="h-5 w-24 rounded-md bg-surface-2" />
          </div>
          {/* Progress bar */}
          <div className="mb-4 h-2 w-full rounded-full bg-surface-2" />
          {/* Achievement rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 border-b border-border py-3 last:border-0"
            >
              <div className="h-12 w-12 flex-shrink-0 rounded-sm bg-surface-2" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 rounded bg-surface-2" />
                <div className="h-3 w-3/4 rounded bg-surface-2" />
                <div className="h-3 w-1/4 rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Store meta panel skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-24 rounded-md bg-surface-2" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-5/6 rounded bg-surface-2" />
            <div className="h-4 w-4/6 rounded bg-surface-2" />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 w-16 rounded-sm bg-surface-2" />
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-surface-2" />
            ))}
          </div>
          <div className="h-7 w-20 rounded-md bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
