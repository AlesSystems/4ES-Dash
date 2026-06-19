/**
 * Unit tests for prisma/seed-data.ts
 *
 * Critical regression guard: ensures the seed NEVER writes rows under
 * process.env.STEAM_ID — only under the dedicated synthetic SEED_STEAM_ID.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEED_DAYS, SEED_STEAM_ID, buildSeedRows } from '@/prisma/seed-data';

describe('SEED_STEAM_ID', () => {
  it('is the synthetic placeholder 76561190000000000', () => {
    expect(SEED_STEAM_ID).toBe('76561190000000000');
  });

  it('is a 17-digit string', () => {
    expect(typeof SEED_STEAM_ID).toBe('string');
    expect(SEED_STEAM_ID).toMatch(/^\d{17}$/);
  });
});

describe('buildSeedRows', () => {
  const FIXED_TODAY = new Date('2026-06-18T00:00:00Z');

  it('returns a non-empty array of rows', () => {
    const rows = buildSeedRows(FIXED_TODAY);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('every row has steamId === SEED_STEAM_ID', () => {
    const rows = buildSeedRows(FIXED_TODAY);
    for (const row of rows) {
      expect(row.steamId).toBe(SEED_STEAM_ID);
    }
  });

  describe('critical regression: env var cannot leak into seed writes', () => {
    const REAL_STEAM_ID = '76561198848120642';
    let original: string | undefined;

    beforeEach(() => {
      original = process.env['STEAM_ID'];
      process.env['STEAM_ID'] = REAL_STEAM_ID;
    });

    afterEach(() => {
      if (original === undefined) {
        delete process.env['STEAM_ID'];
      } else {
        process.env['STEAM_ID'] = original;
      }
    });

    it('ignores process.env.STEAM_ID — all rows still use SEED_STEAM_ID', () => {
      const rows = buildSeedRows(FIXED_TODAY);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.steamId).toBe(SEED_STEAM_ID);
        expect(row.steamId).not.toBe(REAL_STEAM_ID);
      }
    });
  });

  it('playtimeForever is monotonic non-decreasing per appId over time', () => {
    const rows = buildSeedRows(FIXED_TODAY);

    // Group rows by appId, sort by date ascending, check monotonicity.
    const byApp = new Map<number, Array<{ date: Date; playtimeForever: number }>>();
    for (const row of rows) {
      if (!byApp.has(row.appId)) byApp.set(row.appId, []);
      byApp.get(row.appId)!.push({ date: row.date, playtimeForever: row.playtimeForever });
    }

    for (const [, entries] of byApp) {
      entries.sort((a, b) => a.date.getTime() - b.date.getTime());
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i]!.playtimeForever).toBeGreaterThanOrEqual(
          entries[i - 1]!.playtimeForever,
        );
      }
    }
  });

  it(`generates rows spanning SEED_DAYS (${SEED_DAYS}) worth of dates`, () => {
    const rows = buildSeedRows(FIXED_TODAY);
    const dates = new Set(rows.map((r) => r.date.toISOString()));
    // There are at most SEED_DAYS distinct dates (some games have firstDayOffset > 0
    // so there may be fewer unique dates, but never more).
    expect(dates.size).toBeLessThanOrEqual(SEED_DAYS);
    expect(dates.size).toBeGreaterThan(0);
  });
});
