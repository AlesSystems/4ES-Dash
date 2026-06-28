/**
 * components/dashboard/AchievementKpiSection.tsx
 *
 * Async server wrapper for the Achievements KPI tile (bug-01 fix).
 *
 * Lives in its own module (not inline in app/page.tsx) so the homepage tests
 * can stub it with a synchronous no-op — async server components cannot be
 * rendered by @testing-library in jsdom (ERR-0006).
 *
 * `steamId` + the bounded `appIds` are resolved ONCE by the page and passed in,
 * so this component re-resolves neither the viewer nor the profile.
 */

import { getAchievementProgress } from '@/server/repositories/achievements';
import { AchievementKpiCell } from '@/components/dashboard/KpiRow';

export async function AchievementKpiSection({
  steamId,
  appIds,
}: {
  steamId: string;
  appIds: number[];
}): Promise<JSX.Element> {
  const result = await getAchievementProgress(steamId, appIds);
  const percent = result.available ? result.data.percent : null;
  return <AchievementKpiCell percent={percent} />;
}

export function AchievementKpiSkeleton(): JSX.Element {
  return (
    <div className="px-6 py-5" aria-busy="true" aria-label="Achievements loading">
      <div className="mb-3 text-caption font-medium uppercase tracking-widest text-text-3">
        Achievements
      </div>
      <div className="font-serif text-numeral tabular-nums leading-none text-text-3">—</div>
    </div>
  );
}
