import { getLibraryValue } from '@/server/repositories/library-value';
import { LibraryValueCard } from '@/components/dashboard/LibraryValueCard';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Async server component for the dashboard library-value widget (#29, #85).
 *
 * The expensive O(N) Store pricing now runs in the nightly job, which writes a
 * single `LibraryValueAggregate` row; this component only READS that row, so its
 * Steam fan-out is zero regardless of library size. It still lives inside its
 * own `<Suspense>` boundary on the dashboard (and in its own module, not inline
 * in app/page.tsx, so dashboard unit tests can mock it with a synchronous stub —
 * async server components can't be rendered by @testing-library in jsdom).
 *
 * `steamId` is resolved ONCE by the page and passed in — this component no
 * longer re-resolves the viewer (getViewerSteamId) or re-fetches the profile.
 *
 * Before the first nightly run the aggregate is absent → a designed "value
 * pending" state, never a synchronous live fan-out and never a fabricated $0.
 */
export async function LibraryValueSection({ steamId }: { steamId: string }): Promise<JSX.Element> {
  const result = await getLibraryValue(steamId);

  if (!result.available) {
    return <LibraryValuePending />;
  }

  return <LibraryValueCard value={result.data} />;
}

/** Designed "value pending" state shown before the first nightly value run. */
function LibraryValuePending(): JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <p className="text-caption font-medium uppercase tracking-widest text-text-3">
        Library value
      </p>
      <p className="mt-3 font-serif text-h2 font-normal leading-tight text-text-2">Pending</p>
      <p className="mt-3 text-caption leading-snug text-text-3">
        We&rsquo;ll total your library&rsquo;s current store value after the next sync.
      </p>
    </section>
  );
}

export function LibraryValueSkeleton(): JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-6" aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-16 w-40" />
      <Skeleton className="mt-4 h-3 w-full" />
    </section>
  );
}
