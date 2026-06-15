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
  friendList: 86400, // 24 h
  storeMetadata: 604800, // 7 days
  storePrice: 3600, // 1 h
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
