import { z } from 'zod';

// ---------------------------------------------------------------------------
// Raw Steam API response schemas (lenient — only assert what we need)
// ---------------------------------------------------------------------------

const RawPlayerSchema = z.object({
  steamid: z.string(),
  personaname: z.string(),
  profileurl: z.string(),
  avatar: z.string(),
  avatarmedium: z.string(),
  avatarfull: z.string(),
  timecreated: z.number().optional(),
  loccountrycode: z.string().optional(),
  personastate: z.number().optional(),
  communityvisibilitystate: z.number().optional(),
  // Present only when the player is in a game and their status is public.
  gameextrainfo: z.string().optional(),
  gameid: z.string().optional(),
});

export const RawPlayerSummaries = z.object({
  response: z.object({
    players: z.array(RawPlayerSchema),
  }),
});

const RawGameSchema = z.object({
  appid: z.number(),
  name: z.string().optional(),
  playtime_forever: z.number(),
  playtime_2weeks: z.number().optional(),
  img_icon_url: z.string().optional(),
  has_community_visible_stats: z.boolean().optional(),
  rtime_last_played: z.number().optional(),
});

export const RawOwnedGames = z.object({
  response: z.object({
    game_count: z.number().optional(),
    games: z.array(RawGameSchema).optional(),
  }),
});

// ---------------------------------------------------------------------------
// Domain output schemas + inferred types
// ---------------------------------------------------------------------------

export const PlayerSummarySchema = z.object({
  steamId: z.string(),
  personaName: z.string(),
  avatar: z.object({
    small: z.string(),
    medium: z.string(),
    full: z.string(),
  }),
  profileUrl: z.string(),
  /** ISO-8601 UTC string, or null when Steam omits timecreated (private/new accounts). */
  createdAt: z.string().nullable(),
  countryCode: z.string().optional(),
});

export type PlayerSummary = z.infer<typeof PlayerSummarySchema>;

export const OwnedGameSchema = z.object({
  appId: z.number(),
  name: z.string(),
  iconUrl: z.string().nullable(),
  /** Always resolvable — uses the standard CDN header path. */
  headerUrl: z.string(),
  playtime: z.object({
    total: z.number(),
    twoWeeks: z.number(),
  }),
  /** ISO-8601 UTC string, or null when never played / Steam omits the field. */
  lastPlayed: z.string().nullable(),
  hasAchievements: z.boolean(),
});

export type OwnedGame = z.infer<typeof OwnedGameSchema>;

// ---------------------------------------------------------------------------
// Friends (Phase 3, #30/#33)
// ---------------------------------------------------------------------------

/**
 * Normalised friend online status. Steam's `personastate` collapses to three
 * buckets the UI cares about (ACCEPTANCE: Online / Away / Offline):
 *   0 → 'offline'
 *   1, 5 (looking to trade), 6 (looking to play) → 'online'
 *   2 (busy), 3 (away), 4 (snooze) → 'away'
 * A player with a hidden/private profile reports 0 → treated as 'offline'.
 */
export type FriendStatus = 'online' | 'away' | 'offline';

export const FriendSummarySchema = z.object({
  steamId: z.string(),
  personaName: z.string(),
  avatar: z.object({
    small: z.string(),
    medium: z.string(),
    full: z.string(),
  }),
  profileUrl: z.string(),
  status: z.enum(['online', 'away', 'offline']),
  /** True when `playing` is non-null — convenience flag for the "Now playing" group. */
  inGame: z.boolean(),
  /**
   * The game the friend is currently in, when their status is public.
   * `appId` is null when Steam reports a non-Steam game (gameextrainfo without
   * a numeric gameid). Null overall when the friend is not in a game.
   */
  playing: z
    .object({
      appId: z.number().nullable(),
      name: z.string(),
    })
    .nullable(),
  /** ISO-8601 UTC string from GetFriendList `friend_since`, or null if absent. */
  friendSince: z.string().nullable(),
});

export type FriendSummary = z.infer<typeof FriendSummarySchema>;
