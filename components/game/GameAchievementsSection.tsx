/**
 * GameAchievementsSection — async server subcomponent for the game detail page.
 *
 * Fetches achievement data independently from store metadata, enabling the
 * achievements section to stream in via its own Suspense boundary without
 * blocking the StoreMetaPanel and vice-versa.
 *
 * Server component — no "use client", no useEffect.
 * Degradation is handled inside AchievementList (private/no-achievements/unknown).
 */

import { getGameAchievements } from '@/server/repositories/achievements';
import { AchievementList } from '@/components/game/AchievementList';

export interface GameAchievementsSectionProps {
  appId: number;
}

export async function GameAchievementsSection({
  appId,
}: GameAchievementsSectionProps): Promise<JSX.Element> {
  const result = await getGameAchievements(appId);
  return <AchievementList result={result} />;
}
