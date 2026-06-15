// Steam Web API client — public surface
export { getOwnedGames, getPlayerSummaries } from './client';
export {
  isSteamApiError,
  SteamApiError,
  type SteamApiErrorInit,
  type SteamErrorKind,
} from './errors';
export {
  OwnedGameSchema,
  PlayerSummarySchema,
  RawOwnedGames,
  RawPlayerSummaries,
  type OwnedGame,
  type PlayerSummary,
} from './schemas';
export { getRecentlyPlayedGames, type RecentGame } from './recently-played';
export { getSteamLevel } from './level';
export {
  getPlayerAchievements,
  getSchemaForGame,
  getGlobalAchievementPercentages,
  type PlayerAchievement,
  type AchievementSchema,
} from './achievements';
export {
  getStoreMetadata,
  getStorePrice,
  type StoreMetadata,
  type StorePrice,
} from './store-client';
