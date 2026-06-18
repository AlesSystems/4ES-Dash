/**
 * Skeleton fallbacks for the game detail page's independent sections.
 *
 * Each skeleton matches the final geometry of its loaded counterpart so the
 * Suspense swap produces zero CLS. Composed from the `Skeleton` primitive —
 * no hand-rolled `animate-pulse` divs. Co-located with the game components.
 *
 * Server-safe: no "use client".
 */

import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// GameAchievementsSkeleton
// Matches AchievementList geometry: section > heading row + progress bar + items
// ---------------------------------------------------------------------------

export function GameAchievementsSkeleton(): JSX.Element {
  return (
    <section aria-labelledby="achievements-heading" aria-busy="true">
      {/* Heading row: "Achievements  X of Y unlocked" */}
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Progress bar */}
      <Skeleton className="h-2 w-full rounded-full" />

      {/* Achievement rows — 5 placeholder rows matching list item geometry */}
      <ul className="mt-4 divide-y divide-border" aria-label="Achievement list">
        {Array.from({ length: 5 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={i} className="flex items-start gap-4 py-3">
            {/* Icon placeholder */}
            <Skeleton className="h-12 w-12 flex-shrink-0 rounded-sm" />
            {/* Text block */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3 w-20" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// GameStoreSkeleton
// Matches StoreMetaPanel geometry: section > heading + description + chips + dl
// ---------------------------------------------------------------------------

export function GameStoreSkeleton(): JSX.Element {
  return (
    <section aria-labelledby="store-meta-heading" aria-busy="true">
      {/* Heading */}
      <Skeleton className="mb-3 h-6 w-24" />

      {/* Short description — 3 lines */}
      <div className="mb-4 space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Genres chips row */}
      <div className="mb-3">
        <Skeleton className="mb-1.5 h-3 w-14" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-16 rounded-sm" />
          <Skeleton className="h-5 w-20 rounded-sm" />
        </div>
      </div>

      {/* Features chips row */}
      <div className="mb-4">
        <Skeleton className="mb-1.5 h-3 w-16" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-24 rounded-sm" />
          <Skeleton className="h-5 w-28 rounded-sm" />
        </div>
      </div>

      {/* Metadata dl rows */}
      <dl className="flex flex-col gap-2 border-t border-border pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <Skeleton className="h-3 w-20 sm:w-28 sm:shrink-0" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </dl>

      {/* Price placeholder */}
      <div className="mt-4">
        <Skeleton className="h-7 w-16" />
      </div>
    </section>
  );
}
