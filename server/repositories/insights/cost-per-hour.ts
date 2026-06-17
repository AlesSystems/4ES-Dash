/**
 * Cost-per-hour repository (Phase 4, issue #36).
 *
 * Ranks the user's paid games by cost-per-hour using manual price-paid data
 * (when available) or current store price as fallback.
 */

import { prisma } from '@/server/db';
import { getEnv } from '@/server/env';
import { getGameStorePrice } from '@/server/repositories/store';
import {
  rankCostPerHour,
  type CostPerHourResult,
  type CostInput,
  type CostPrice,
} from '@/lib/insights';
import { isAvailable } from '@/lib/result';

/**
 * Computes cost-per-hour rankings for the user's owned games.
 *
 * Price resolution order per game:
 *   1. ManualGameData.pricePaidCents (user-supplied) → kind: 'paid'
 *   2. Store API current price → kind: 'free' | 'paid' | 'unavailable'
 *
 * When manual pricePaidCents is set but manual.currency is null, the store
 * price is fetched solely to retrieve the currency. Falls back to 'USD'.
 */
export async function getCostPerHour(
  steamId?: string,
): Promise<{ result: CostPerHourResult; stale: boolean }> {
  const id = steamId ?? getEnv().STEAM_ID;

  const ownedGames = await prisma.ownedGame.findMany({
    where: { steamId: id },
    select: { appId: true, playtimeForever: true },
  });

  const appIds = ownedGames.map((g) => g.appId);

  const [gameRecords, manualDataRecords] = await Promise.all([
    prisma.game.findMany({
      where: { appId: { in: appIds } },
      select: { appId: true, name: true },
    }),
    prisma.manualGameData.findMany({
      where: { steamId: id, appId: { in: appIds } },
      select: { appId: true, pricePaidCents: true, currency: true },
    }),
  ]);

  const names = new Map<number, string>(gameRecords.map((g) => [g.appId, g.name]));
  const manualByAppId = new Map(manualDataRecords.map((m) => [m.appId, m]));

  let stale = false;

  const inputs: CostInput[] = await Promise.all(
    ownedGames.map(async (game): Promise<CostInput> => {
      const { appId, playtimeForever } = game;
      const name = names.get(appId) ?? `App ${appId}`;
      const manual = manualByAppId.get(appId);

      let price: CostPrice;

      if (manual !== undefined && manual.pricePaidCents !== null) {
        // Manual price-paid is set — determine currency
        let currency: string;
        if (manual.currency !== null) {
          currency = manual.currency;
        } else {
          // Need to fetch store price just for the currency
          const storePriceResult = await getGameStorePrice(appId);
          if (isAvailable(storePriceResult)) {
            if (storePriceResult.stale) stale = true;
            currency = storePriceResult.data?.currency ?? 'USD';
          } else {
            currency = 'USD';
          }
        }
        price = { kind: 'paid', cents: manual.pricePaidCents, currency };
      } else {
        // No manual price — use store price
        const storePriceResult = await getGameStorePrice(appId);
        if (!isAvailable(storePriceResult)) {
          price = { kind: 'unavailable' };
        } else {
          if (storePriceResult.stale) stale = true;
          const storePrice = storePriceResult.data;
          if (storePrice === null || storePrice.finalCents === 0) {
            price = { kind: 'free' };
          } else {
            price = {
              kind: 'paid',
              cents: storePrice.finalCents,
              currency: storePrice.currency,
            };
          }
        }
      }

      return { appId, name, playtimeMinutes: playtimeForever, price };
    }),
  );

  return { result: rankCostPerHour(inputs), stale };
}
