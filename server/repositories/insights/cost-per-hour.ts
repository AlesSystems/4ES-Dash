/**
 * Cost-per-hour repository (Phase 4, issue #36).
 *
 * Ranks the user's paid games by cost-per-hour using the CURRENT Steam store
 * price only. Per docs/ACCEPTANCE.md §"Cost-per-hour ranking (current prices
 * only)", the page must reflect current store prices — never price-paid — so
 * the persistent disclaimer ("current store prices, not what you paid") stays
 * accurate and no price-paid figure is surfaced here. Imported ManualGameData
 * (#40) is captured/stored but intentionally NOT used as the price source for
 * this ranking. (See PR #74 discussion: ACCEPTANCE.md #36 governs this page.)
 */

import { prisma } from '@/server/db';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import { getGameStorePrice } from '@/server/repositories/store';
import {
  rankCostPerHour,
  type CostPerHourResult,
  type CostInput,
  type CostPrice,
} from '@/lib/insights';
import { isAvailable } from '@/lib/result';

/**
 * Computes cost-per-hour rankings for the user's owned games from current
 * store prices: unavailable → excluded; free/zero → listed separately; else
 * paid with the store's finalCents + currency.
 */
export async function getCostPerHour(
  steamId: string,
): Promise<{ result: CostPerHourResult; stale: boolean }> {
  const id = requireSteamId(steamId, 'getCostPerHour');

  const ownedGames = await prisma.ownedGame.findMany({
    where: { steamId: id },
    select: { appId: true, playtimeForever: true },
  });

  const appIds = ownedGames.map((g) => g.appId);

  const gameRecords = await prisma.game.findMany({
    where: { appId: { in: appIds } },
    select: { appId: true, name: true },
  });

  const names = new Map<number, string>(gameRecords.map((g) => [g.appId, g.name]));

  let stale = false;

  const inputs: CostInput[] = await Promise.all(
    ownedGames.map(async (game): Promise<CostInput> => {
      const { appId, playtimeForever } = game;
      const name = names.get(appId) ?? `App ${appId}`;

      let price: CostPrice;

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

      return { appId, name, playtimeMinutes: playtimeForever, price };
    }),
  );

  return { result: rankCostPerHour(inputs), stale };
}
