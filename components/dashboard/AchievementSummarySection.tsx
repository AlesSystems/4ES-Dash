import { getAchievementProgress } from '@/server/repositories/achievements';
import { AchievementSummary } from '@/components/dashboard/AchievementSummary';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Async server component for the dashboard achievement summary (#18, #85).
 *
 * Aggregating achievement progress costs up to ~3 rate-limited Steam calls per
 * game over the top-N most-played games — far too slow to block first paint
 * (~38 s cold on a large library, see ERR-0003). It now streams inside its own
 * `<Suspense>` boundary instead of being awaited in the page's blocking
 * `Promise.all`. It lives in its own module (not inline in app/page.tsx) so the
 * dashboard unit tests can mock it with a synchronous stub — async server
 * components can't be rendered by @testing-library in jsdom (ERR-0006).
 *
 * `steamId` + the bounded `appIds` are resolved ONCE by the page and passed in,
 * so this component re-resolves neither the viewer nor the profile (#85 AC4).
 */
export async function AchievementSummarySection({
  steamId,
  appIds,
}: {
  steamId: string;
  appIds: number[];
}): Promise<JSX.Element> {
  const result = await getAchievementProgress(steamId, appIds);
  return <AchievementSummary result={result} />;
}

export function AchievementSummarySkeleton(): JSX.Element {
  return (
    <section aria-label="Achievement progress" aria-busy="true">
      <Skeleton className="mb-4 h-6 w-40" />
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-3 h-1.5 w-full" />
        <Skeleton className="mt-3 h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-32" />
    </section>
  );
}
