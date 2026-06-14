// Suspense fallback for the homepage. Geometry mirrors app/page.tsx to avoid layout shift.
const SHELL = 'mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8';

export default function HomeLoading() {
  return (
    <main className={SHELL} aria-busy="true" aria-label="Loading your Steam profile">
      {/* Profile header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-surface-2" />
        <div className="h-6 w-48 animate-pulse rounded-md bg-surface-2" />
      </div>

      {/* Game grid skeleton */}
      <div className="mt-8">
        <div className="mb-4 h-5 w-56 animate-pulse rounded-md bg-surface-2" />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <li key={i} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="aspect-[2/1] w-full animate-pulse bg-surface-2" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
