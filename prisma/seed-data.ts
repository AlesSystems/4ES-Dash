/**
 * Pure seed data helpers — no I/O, no side effects, no database imports.
 *
 * Extracted from seed.ts so that tests can import and verify seed logic
 * without touching the database or running the seed script.
 *
 * IMPORTANT: SEED_STEAM_ID is a deliberately synthetic placeholder that MUST
 * never collide with a real Steam account. It is chosen to be outside the
 * range of valid SteamID64s issued by Valve (which start at 76561197960265729).
 * The value 76561190000000000 is well below that floor and will never be
 * assigned to a real user. Do NOT replace this with process.env.STEAM_ID.
 */

/** Synthetic SteamID64 used exclusively for dev-seed data. Never a real account. */
export const SEED_STEAM_ID = '76561190000000000';

/** Number of days of playtime history the seed generates. */
export const SEED_DAYS = 60;

/** Synthetic games seeded into the dev database. */
export const GAMES = [
  { appId: 730, name: 'Counter-Strike 2', dailyMinutes: 45, firstDayOffset: 0 },
  { appId: 570, name: 'Dota 2', dailyMinutes: 30, firstDayOffset: 10 },
  { appId: 440, name: 'Team Fortress 2', dailyMinutes: 12, firstDayOffset: 25 },
  { appId: 292030, name: 'The Witcher 3', dailyMinutes: 20, firstDayOffset: 40 },
  { appId: 1086940, name: "Baldur's Gate 3", dailyMinutes: 0, firstDayOffset: 5 },
] as const;

/**
 * Truncates a Date to midnight UTC — the canonical day key used for snapshots.
 */
export function utcDayKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Builds the array of PlaytimeSnapshot rows for seeding.
 *
 * @param today - The anchor date (pass `utcDayKey(new Date())` in production;
 *                pass a fixed date in tests for determinism).
 * @returns Rows ready to be passed to `prisma.playtimeSnapshot.createMany`.
 *
 * NOTE: steamId is ALWAYS SEED_STEAM_ID — never process.env.STEAM_ID.
 */
export function buildSeedRows(
  today: Date,
): Array<{ steamId: string; appId: number; date: Date; playtimeForever: number }> {
  const rows: Array<{ steamId: string; appId: number; date: Date; playtimeForever: number }> = [];

  for (let dayBack = SEED_DAYS - 1; dayBack >= 0; dayBack -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - dayBack);
    const dayIndex = SEED_DAYS - 1 - dayBack; // 0 = oldest, SEED_DAYS-1 = today

    for (const game of GAMES) {
      if (dayIndex < game.firstDayOffset) continue; // not yet "acquired"
      const elapsed = dayIndex - game.firstDayOffset;
      rows.push({
        steamId: SEED_STEAM_ID, // hard-coded — never from env
        appId: game.appId,
        date,
        playtimeForever: elapsed * game.dailyMinutes,
      });
    }
  }

  return rows;
}
