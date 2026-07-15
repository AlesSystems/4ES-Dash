/**
 * Single source of truth for all cache TTLs (in seconds).
 * No magic numbers elsewhere — import from here.
 */
export const TTL = Object.freeze({
  playerSummaries: 300, // 5 min
  ownedGames: 3600, // 1 h
  recentlyPlayed: 900, // 15 min
  steamLevel: 86400, // 24 h
  playerAchievements: 3600, // 1 h
  // Per-app achievement reference data ('global' pseudo-steamId caches).
  // Warm-instance-only win: the in-process cache empties on serverless cold
  // start, so full effect awaits the bug-3 durable-cache decision (STEAM-2
  // residual, PLAN-theme-2-external-fanouts T4).
  achievementSchema: 604800, // 7 d — per-app schema; changes on rare dev pushes (DLC)
  achievementGlobal: 86400, // 24 h — global unlock percentages; slow-moving
  friendList: 86400, // 24 h
  storeMetadata: 604800, // 7 days
  storePrice: 3600, // 1 h
  steamSpy: 86400, // 24 h — SteamSpy enrichment (#38); honours their ≥24h cache ask
  itadPrice: 86400, // 24 h — ITAD historical-low price (#39); changes slowly
  // Insights/history aggregates derived from snapshot tables (Theme 1 / T5,
  // DATA-4). Snapshot tables are written once nightly, so 6 h is safe.
  insightsAggregate: 21600, // 6 h — snapshot-derived aggregates (idle, YiR, cost/h, genres, history)
} as const);

export type TtlKey = keyof typeof TTL;

/**
 * Builds a namespaced cache key.
 *
 * Format: `steam:<endpoint>:<steamId>[:<appId>]`
 * The endpoint is normalised to lowercase (callers should already pass
 * kebab-case, e.g. `"owned-games"`).
 *
 * @example
 * cacheKey('owned-games', '76561198000000000')      // "steam:owned-games:76561198000000000"
 * cacheKey('owned-games', '76561198000000000', 730)  // "steam:owned-games:76561198000000000:730"
 */
export function cacheKey(endpoint: string, steamId: string, appId?: number): string {
  const base = `steam:${endpoint.toLowerCase()}:${steamId}`;
  return appId !== undefined ? `${base}:${appId}` : base;
}
