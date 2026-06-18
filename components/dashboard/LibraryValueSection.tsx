import { getLibraryValue } from '@/server/repositories/library-value';
import { LibraryValueCard } from '@/components/dashboard/LibraryValueCard';
import { Skeleton } from '@/components/ui/skeleton';
import { getViewerSteamId } from '@/server/auth';

/**
 * Async server component for the dashboard library-value widget (#29).
 *
 * Summing the current store price of every owned game is many rate-limited
 * Store API calls on a cold cache, so this is rendered inside its own
 * `<Suspense>` boundary on the dashboard and streams in without blocking the
 * rest of the page. It lives in its own module (not inline in app/page.tsx) so
 * unit tests of the dashboard can mock it with a synchronous stub — async
 * server components can't be rendered by @testing-library in jsdom.
 */
export async function LibraryValueSection(): Promise<JSX.Element> {
  const viewerId = await getViewerSteamId();
  const value = await getLibraryValue(viewerId);
  return <LibraryValueCard value={value} />;
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
