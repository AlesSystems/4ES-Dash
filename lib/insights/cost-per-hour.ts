/**
 * Cost-per-hour ranking for the Insights panel (issue #36).
 *
 * Pure module — no I/O, no server imports. Accepts a list of games with their
 * price and playtime, then ranks paid games by cost-per-hour (most expensive
 * per hour first). Free games and price-unavailable games are returned in
 * separate buckets.
 *
 * Formula: costPerHourCents = priceCents / max(rawHours, MIN_HOURS)
 * where rawHours = playtimeMinutes / 60 (un-rounded, to avoid division distortion).
 * The display field playtimeHours is minutes/60 rounded to 1 decimal.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Price information for one game — three possible states. */
export type CostPrice =
  | { kind: 'paid'; cents: number; currency: string }
  | { kind: 'free' } // free-to-play (price 0 / null)
  | { kind: 'unavailable' }; // Store API couldn't return a price

/** Input record for a single game. */
export interface CostInput {
  appId: number;
  name: string;
  playtimeMinutes: number;
  price: CostPrice;
}

/** A ranked paid game entry. */
export interface CostRankRow {
  appId: number;
  name: string;
  /** minutes / 60 rounded to 1 decimal (display only). */
  playtimeHours: number;
  priceCents: number;
  currency: string;
  /** priceCents / max(rawHours, MIN_HOURS), rounded to nearest integer cent. */
  costPerHourCents: number;
}

/** The complete cost-per-hour computation result. */
export interface CostPerHourResult {
  /** Paid games with playtimeMinutes > 0, sorted by costPerHourCents DESC. */
  ranked: CostRankRow[];
  /** price.kind === 'free' games (any playtime), sorted by playtimeMinutes desc. */
  freeGames: { appId: number; name: string; playtimeMinutes: number }[];
  /** Paid games with playtimeMinutes <= 0 (would be infinite cost-per-hour). */
  excludedNoPlaytime: number;
  /** Games where price.kind === 'unavailable'. */
  excludedNoPrice: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum hours denominator to avoid division by near-zero. */
export const MIN_HOURS = 0.1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ranks games by cost per hour of playtime.
 *
 * Paid games with no playtime are excluded (infinite cost) and counted in
 * `excludedNoPlaytime`. Games with unavailable prices are counted in
 * `excludedNoPrice`. Free games are returned in a separate `freeGames` list.
 */
export function rankCostPerHour(inputs: CostInput[]): CostPerHourResult {
  const ranked: CostRankRow[] = [];
  const freeGames: { appId: number; name: string; playtimeMinutes: number }[] = [];
  let excludedNoPlaytime = 0;
  let excludedNoPrice = 0;

  for (const input of inputs) {
    const { appId, name, playtimeMinutes, price } = input;

    if (price.kind === 'unavailable') {
      excludedNoPrice++;
      continue;
    }

    if (price.kind === 'free') {
      freeGames.push({ appId, name, playtimeMinutes });
      continue;
    }

    // price.kind === 'paid'
    if (playtimeMinutes <= 0) {
      excludedNoPlaytime++;
      continue;
    }

    const rawHours = playtimeMinutes / 60;
    const clampedHours = Math.max(rawHours, MIN_HOURS);
    const costPerHourCents = Math.round(price.cents / clampedHours);
    const playtimeHours = Math.round(rawHours * 10) / 10;

    ranked.push({
      appId,
      name,
      playtimeHours,
      priceCents: price.cents,
      currency: price.currency,
      costPerHourCents,
    });
  }

  // Sort paid games: most expensive per hour first.
  ranked.sort((a, b) => b.costPerHourCents - a.costPerHourCents);

  // Sort free games: most played first.
  freeGames.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);

  return { ranked, freeGames, excludedNoPlaytime, excludedNoPrice };
}
