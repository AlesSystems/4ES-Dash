/**
 * Unit tests for server/repositories/insights/idle.ts
 * Prisma is mocked via vi.hoisted — no I/O.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIdleFlags, dismissIdleFlag } from '@/server/repositories/insights/idle';

const mockPrisma = vi.hoisted(() => ({
  playtimeSnapshot: { findMany: vi.fn() },
  idleDismissal: { findMany: vi.fn(), upsert: vi.fn() },
  game: { findMany: vi.fn() },
}));

vi.mock('@/server/db', () => ({ prisma: mockPrisma }));

const STEAM_ID = '76561198000000000';

function snap(appId: number, dateStr: string, playtimeForever: number) {
  return { appId, date: new Date(dateStr), playtimeForever };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.idleDismissal.findMany.mockResolvedValue([]);
  mockPrisma.game.findMany.mockResolvedValue([]);
});

describe('getIdleFlags', () => {
  it('returns empty when no snapshots', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([]);
    expect(await getIdleFlags(STEAM_ID)).toEqual([]);
  });

  it('returns a spike flag with correct view fields', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      snap(730, '2025-01-01T00:00:00.000Z', 0),
      snap(730, '2025-01-02T00:00:00.000Z', 800), // delta 800 > 720
    ]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'Counter-Strike 2' }]);
    const flags = await getIdleFlags(STEAM_ID);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.appId).toBe(730);
    expect(flags[0]!.name).toBe('Counter-Strike 2');
    expect(flags[0]!.deltaMinutes).toBe(800);
  });

  it('filters out dismissed flags', async () => {
    const fromDate = new Date('2025-01-01T00:00:00.000Z');
    const toDate = new Date('2025-01-02T00:00:00.000Z');
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: fromDate, playtimeForever: 0 },
      { appId: 730, date: toDate, playtimeForever: 800 },
    ]);
    mockPrisma.idleDismissal.findMany.mockResolvedValue([{ appId: 730, fromDate, toDate }]);
    expect(await getIdleFlags(STEAM_ID)).toEqual([]);
  });

  it('still returns flag in a NEW window after dismissing a different window', async () => {
    const fromDate1 = new Date('2025-01-01T00:00:00.000Z');
    const toDate1 = new Date('2025-01-02T00:00:00.000Z');
    const toDate2 = new Date('2025-01-03T00:00:00.000Z');
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      { appId: 730, date: fromDate1, playtimeForever: 0 },
      { appId: 730, date: toDate1, playtimeForever: 800 }, // dismissed
      { appId: 730, date: toDate2, playtimeForever: 1600 }, // new spike: delta 800
    ]);
    // Only first window dismissed
    mockPrisma.idleDismissal.findMany.mockResolvedValue([
      { appId: 730, fromDate: fromDate1, toDate: toDate1 },
    ]);
    mockPrisma.game.findMany.mockResolvedValue([{ appId: 730, name: 'CS2' }]);
    const flags = await getIdleFlags(STEAM_ID);
    // The second pair (toDate1→toDate2) is a new window, not dismissed
    expect(flags.length).toBeGreaterThanOrEqual(1);
    const newFlag = flags.find((f) => f.toDate.getTime() === toDate2.getTime());
    expect(newFlag).toBeDefined();
  });

  it('uses App fallback for name when game not in DB', async () => {
    mockPrisma.playtimeSnapshot.findMany.mockResolvedValue([
      snap(999, '2025-01-01T00:00:00.000Z', 0),
      snap(999, '2025-01-02T00:00:00.000Z', 800),
    ]);
    mockPrisma.game.findMany.mockResolvedValue([]);
    const flags = await getIdleFlags(STEAM_ID);
    expect(flags[0]!.name).toBe('App 999');
  });
});

describe('dismissIdleFlag', () => {
  it('calls prisma upsert with correct compound key', async () => {
    const fromDate = new Date('2025-01-01T00:00:00.000Z');
    const toDate = new Date('2025-01-02T00:00:00.000Z');
    mockPrisma.idleDismissal.upsert.mockResolvedValue({});
    await dismissIdleFlag(STEAM_ID, { appId: 730, fromDate, toDate });
    expect(mockPrisma.idleDismissal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          steamId_appId_fromDate_toDate: expect.objectContaining({
            steamId: STEAM_ID,
            appId: 730,
          }),
        }),
      }),
    );
  });
});
