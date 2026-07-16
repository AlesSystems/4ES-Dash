import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OwnedGame } from '@/lib/steam/schemas';

// ---------------------------------------------------------------------------
// Mocks (theme-5 T3): runSnapshotForUser/runSnapshot are exercised as units —
// every I/O dependency is replaced so the tests measure structure, not Steam.
// ---------------------------------------------------------------------------

const STEAM_ID = '76561198000000000';

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getGameAchievements: vi.fn(),
  refreshLibraryValueAggregate: vi.fn(),
  refreshGameStoreData: vi.fn(),
  prisma: {
    user: { upsert: vi.fn(), findMany: vi.fn() },
    playtimeSnapshot: { findMany: vi.fn(), groupBy: vi.fn(), upsert: vi.fn() },
    achievementSnapshot: { upsert: vi.fn() },
    achievementUnlock: { upsert: vi.fn() },
    jobRun: { create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/server/repositories/profile', () => ({ getProfile: mocks.getProfile }));
vi.mock('@/server/repositories/achievements', () => ({
  getGameAchievements: mocks.getGameAchievements,
}));
vi.mock('@/server/repositories/library-value', () => ({
  refreshLibraryValueAggregate: mocks.refreshLibraryValueAggregate,
}));
vi.mock('@/server/repositories/game-store', () => ({
  refreshGameStoreData: mocks.refreshGameStoreData,
}));
vi.mock('@/server/env', () => ({ getEnv: () => ({ STEAM_ID }) }));

import { utcDayKey, clampPlaytime, runSnapshotForUser, runSnapshot } from '@/server/jobs/snapshot';

function makeGame(appId: number, total: number): OwnedGame {
  return {
    appId,
    name: `Game ${appId}`,
    iconUrl: null,
    headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    playtime: { total, twoWeeks: 0 },
    lastPlayed: null,
    hasAchievements: true,
  };
}

const TIMING_KEYS = [
  'playtimeMs',
  'achievementSnapshotMs',
  'unlockRecordingMs',
  'libraryValueMs',
  'gameStoreMs',
] as const;

function primeHappyPath(): void {
  mocks.getProfile.mockResolvedValue({
    profile: {
      steamId: STEAM_ID,
      personaName: 'Test',
      avatar: { small: 'x', medium: 'x', full: 'x' },
      profileUrl: 'https://steamcommunity.com/id/test/',
      createdAt: null,
    },
    games: [makeGame(730, 100), makeGame(570, 50)],
  });
  mocks.getGameAchievements.mockResolvedValue({ available: false, reason: 'no_achievements' });
  mocks.refreshLibraryValueAggregate.mockResolvedValue(undefined);
  mocks.refreshGameStoreData.mockResolvedValue(undefined);
  mocks.prisma.playtimeSnapshot.groupBy.mockResolvedValue([]);
  mocks.prisma.playtimeSnapshot.findMany.mockResolvedValue([]);
  mocks.prisma.user.findMany.mockResolvedValue([]);
  mocks.prisma.jobRun.create.mockResolvedValue({ id: 'job-1' });
  mocks.prisma.jobRun.update.mockResolvedValue({ id: 'job-1' });
}

describe('utcDayKey', () => {
  it('truncates a timestamp to UTC midnight', () => {
    const key = utcDayKey(new Date('2026-06-16T18:30:45.123Z'));
    expect(key.toISOString()).toBe('2026-06-16T00:00:00.000Z');
  });

  it('uses the UTC calendar day, not local time', () => {
    // 23:30 UTC is still the 16th in UTC even if local time has rolled over.
    const key = utcDayKey(new Date('2026-06-16T23:30:00.000Z'));
    expect(key.getUTCHours()).toBe(0);
    expect(key.getUTCDate()).toBe(16);
  });
});

describe('clampPlaytime (monotonic)', () => {
  it('keeps the reported value when it is greater than the previous', () => {
    expect(clampPlaytime(100, 50)).toEqual({ value: 100, clamped: false });
  });

  it('clamps up to the previous value when Steam reports a decrease', () => {
    expect(clampPlaytime(40, 50)).toEqual({ value: 50, clamped: true });
  });

  it('does not clamp when equal', () => {
    expect(clampPlaytime(50, 50)).toEqual({ value: 50, clamped: false });
  });

  it('treats no prior value (0) as the floor', () => {
    expect(clampPlaytime(10, 0)).toEqual({ value: 10, clamped: false });
  });
});

// ---------------------------------------------------------------------------
// Theme-5 T3: per-pass timings in SnapshotResult → JobRun.payload
// ---------------------------------------------------------------------------

describe('per-pass timings (theme-5 T3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHappyPath();
  });

  it('SnapshotResult includes per-pass timings and batch payload preserves summed keys', async () => {
    const result = await runSnapshotForUser(STEAM_ID);

    // Five non-negative duration keys per user.
    expect(result.timings).toBeDefined();
    for (const key of TIMING_KEYS) {
      const value = result.timings?.[key];
      expect(typeof value, `timings.${key}`).toBe('number');
      expect(value, `timings.${key}`).toBeGreaterThanOrEqual(0);
    }
    expect(Object.keys(result.timings ?? {}).sort()).toEqual([...TIMING_KEYS].sort());

    // Batch payload: summed top-level keys unchanged (HEAD semantics) and
    // per-user timings surfaced through JobRun.payload.
    const batch = await runSnapshot();
    expect(batch.gamesProcessed).toBe(2);
    expect(batch.rowsInserted).toBe(2);
    expect(batch.clamped).toBe(0);
    expect(batch.achievementRowsInserted).toBe(0);
    expect(batch.usersProcessed).toBe(1);

    const updateArg = mocks.prisma.jobRun.update.mock.calls[0]?.[0] as {
      data: { payload?: string };
    };
    const payload = JSON.parse(updateArg.data.payload ?? 'null') as {
      gamesProcessed: number;
      rowsInserted: number;
      clamped: number;
      achievementRowsInserted: number;
      usersProcessed: number;
      results: Array<{ timings?: Record<string, number> }>;
    };
    expect(payload.gamesProcessed).toBe(2);
    expect(payload.rowsInserted).toBe(2);
    expect(payload.clamped).toBe(0);
    expect(payload.achievementRowsInserted).toBe(0);
    expect(payload.usersProcessed).toBe(1);
    for (const key of TIMING_KEYS) {
      const value = payload.results[0]?.timings?.[key];
      expect(typeof value, `payload timings.${key}`).toBe('number');
      expect(value, `payload timings.${key}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('a throwing best-effort pass still records a non-negative timing (finally)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The best-effort passes (snapshot.ts try/catch blocks) throw — timings
    // must still carry all five keys, captured in `finally` (criterion 3).
    mocks.refreshLibraryValueAggregate.mockRejectedValue(new Error('library-value boom'));
    mocks.refreshGameStoreData.mockRejectedValue(new Error('game-store boom'));

    const result = await runSnapshotForUser(STEAM_ID);
    for (const key of TIMING_KEYS) {
      const value = result.timings?.[key];
      expect(typeof value, `timings.${key}`).toBe('number');
      expect(value, `timings.${key}`).toBeGreaterThanOrEqual(0);
    }
    error.mockRestore();
  });
});
