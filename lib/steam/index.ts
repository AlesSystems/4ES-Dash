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
  FriendSummarySchema,
  RawOwnedGames,
  RawPlayerSummaries,
  type OwnedGame,
  type PlayerSummary,
  type FriendSummary,
  type FriendStatus,
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
export {
  getFriendList,
  getPlayerSummariesBatch,
  personaStateToStatus,
  sortFriends,
} from './friends';
