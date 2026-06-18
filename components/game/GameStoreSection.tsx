/**
 * GameStoreSection — async server subcomponent for the game detail page.
 *
 * Fetches store metadata and price independently from achievements, enabling
 * the store panel to stream in via its own Suspense boundary.
 *
 * Server component — no "use client", no useEffect.
 * Degradation is handled inside StoreMetaPanel (metadata-unavailable).
 */

import { getGameStoreMetadata, getGameStorePrice } from '@/server/repositories/store';
import { StoreMetaPanel } from '@/components/game/StoreMetaPanel';

export interface GameStoreSectionProps {
  appId: number;
}

export async function GameStoreSection({ appId }: GameStoreSectionProps): Promise<JSX.Element> {
  const [metadata, price] = await Promise.all([
    getGameStoreMetadata(appId),
    getGameStorePrice(appId),
  ]);
  return <StoreMetaPanel metadata={metadata} price={price} />;
}
