/**
 * Suspense skeleton for the friends page.
 * Geometry mirrors app/friends/page.tsx to prevent layout shift (CLS ≈ 0).
 */

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default function FriendsLoading(): JSX.Element {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading friends">
      {/* Page heading skeleton */}
      <div className="mb-6">
        <div className="h-10 w-44 animate-pulse rounded-md bg-surface-2" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-surface-2" />
      </div>

      {/* Now playing section heading + 3 cards */}
      <div className="mb-8">
        <div className="mb-3.5 h-7 w-36 animate-pulse rounded bg-surface-2" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 rounded-lg border border-border bg-surface p-4"
            >
              {/* Avatar */}
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-surface-2" />
              {/* Text lines */}
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All friends section heading + 8 cards (2-col grid) */}
      <div>
        <div className="mb-3.5 h-7 w-32 animate-pulse rounded bg-surface-2" />
        <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2" role="list">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <div className="flex items-center gap-3.5 rounded-lg border border-border bg-surface p-4">
                {/* Avatar */}
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-surface-2" />
                {/* Text lines */}
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-surface-2" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
