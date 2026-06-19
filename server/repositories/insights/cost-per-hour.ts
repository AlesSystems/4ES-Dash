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
 *
 * Price data is read from the Game table (populated nightly by the enrichment
 * job) — zero Store API calls on the render path.
 */

import { prisma } from '@/server/db';
import { requireSteamId } from '@/server/repositories/require-steam-id';
import {
  rankCostPerHour,
  type CostPerHourResult,
  type CostInput,
  type CostPrice,
} from '@/lib/insights';

/**
 * Computes cost-per-hour rankings for the user's owned games from current
 * store prices stored in the Game table:
 *   - no Game row OR priceRefreshedAt == null → unavailable (excluded)
 *   - priceIsFree === true → free
 *   - priceIsFree === false && priceFinalCents != null → paid
 *   - otherwise → unavailable
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
    select: {
      appId: true,
      name: true,
      priceFinalCents: true,
      priceCurrency: true,
      priceIsFree: true,
      priceRefreshedAt: true,
    },
  });

  type GameRow = (typeof gameRecords)[number];
  const gameMap = new Map<number, GameRow>(gameRecords.map((g) => [g.appId, g]));

  const inputs: CostInput[] = ownedGames.map((game): CostInput => {
    const { appId, playtimeForever } = game;
    const row = gameMap.get(appId);
    const name = row?.name ?? `App ${appId}`;

    let price: CostPrice;

    if (!row || row.priceRefreshedAt === null) {
      // Never priced or no record — treat as unavailable
      price = { kind: 'unavailable' };
    } else if (row.priceIsFree === true) {
      price = { kind: 'free' };
    } else if (row.priceIsFree === false && row.priceFinalCents != null) {
      price = {
        kind: 'paid',
        cents: row.priceFinalCents,
        currency: row.priceCurrency ?? 'USD',
      };
    } else {
      // priceIsFree is null or priceFinalCents is null despite priceIsFree=false
      price = { kind: 'unavailable' };
    }

    return { appId, name, playtimeMinutes: playtimeForever, price };
  });

  // DB read is never stale
  return { result: rankCostPerHour(inputs), stale: false };
}
