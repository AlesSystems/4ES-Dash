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
