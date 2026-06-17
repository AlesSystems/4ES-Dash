import { describe, expect, it } from 'vitest';
import type { OwnedGame } from '@/lib/steam/schemas';
import { computeSharedGames } from '@/lib/compare/shared-games';

// ---------------------------------------------------------------------------
// Test factory — keeps fixtures compact and readable.
// ---------------------------------------------------------------------------

function game(
  appId: number,
  name: string,
  total: number,
  overrides: Partial<OwnedGame> = {},
): OwnedGame {
  return {
    appId,
    name,
    iconUrl: null,
    headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    playtime: { total, twoWeeks: 0 },
    lastPlayed: null,
    hasAchievements: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic join behaviour
// ---------------------------------------------------------------------------

describe('computeSharedGames — filtering', () => {
  it('returns only games owned by BOTH users (inner join on appId)', () => {
    const a = [game(1, 'Apex', 100), game(2, 'Bravo', 50)];
    const b = [game(2, 'Bravo', 80), game(3, 'Charlie', 10)];
    const result = computeSharedGames(a, b);
    expect(result).toHaveLength(1);
    expect(result[0]?.appId).toBe(2);
  });

  it('excludes games owned by only user A', () => {
    const a = [game(1, 'Solo-A', 200)];
    const b = [game(2, 'Solo-B', 100)];
    expect(computeSharedGames(a, b)).toHaveLength(0);
  });

  it('excludes games owned by only user B', () => {
    const a = [game(10, 'Shared', 50), game(20, 'Only-A', 30)];
    const b = [game(10, 'Shared', 70)];
    const result = computeSharedGames(a, b);
    expect(result).toHaveLength(1);
    expect(result[0]?.appId).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Delta calculation
// ---------------------------------------------------------------------------

describe('computeSharedGames — delta', () => {
  it('deltaMinutes is Math.abs(playtimeA - playtimeB)', () => {
    const a = [game(1, 'G', 300)];
    const b = [game(1, 'G', 100)];
    const [r] = computeSharedGames(a, b);
    expect(r?.deltaMinutes).toBe(200);
    expect(r?.playtimeA).toBe(300);
    expect(r?.playtimeB).toBe(100);
  });

  it('delta is always positive regardless of which user has more playtime', () => {
    const a = [game(1, 'G', 50)];
    const b = [game(1, 'G', 250)];
    const [r] = computeSharedGames(a, b);
    expect(r?.deltaMinutes).toBe(200); // Math.abs(50 - 250)
    expect(r?.playtimeA).toBe(50);
    expect(r?.playtimeB).toBe(250);
  });

  it('delta is 0 when both users have identical playtime', () => {
    const a = [game(5, 'Equal', 120)];
    const b = [game(5, 'Equal', 120)];
    const [r] = computeSharedGames(a, b);
    expect(r?.deltaMinutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('computeSharedGames — sorting', () => {
  it('sorts by deltaMinutes DESC', () => {
    const a = [game(1, 'Alpha', 500), game(2, 'Beta', 200), game(3, 'Gamma', 100)];
    const b = [game(1, 'Alpha', 100), game(2, 'Beta', 190), game(3, 'Gamma', 50)];
    // deltas: 1→400, 2→10, 3→50
    const result = computeSharedGames(a, b);
    expect(result.map((g) => g.appId)).toEqual([1, 3, 2]);
  });

  it('breaks deltaMinutes ties by name ASC (case-insensitive)', () => {
    // All three have the same delta (0) — should sort alphabetically.
    const a = [game(1, 'Zeta', 100), game(2, 'alpha', 200), game(3, 'Bravo', 300)];
    const b = [game(1, 'Zeta', 100), game(2, 'alpha', 200), game(3, 'Bravo', 300)];
    const result = computeSharedGames(a, b);
    expect(result.map((g) => g.name)).toEqual(['alpha', 'Bravo', 'Zeta']);
  });

  it('identical libraries → all games with delta 0, sorted by name ASC', () => {
    const lib = [game(3, 'Zeta', 10), game(1, 'Alpha', 10), game(2, 'Bravo', 10)];
    const result = computeSharedGames(lib, lib);
    expect(result).toHaveLength(3);
    expect(result.every((g) => g.deltaMinutes === 0)).toBe(true);
    expect(result.map((g) => g.name)).toEqual(['Alpha', 'Bravo', 'Zeta']);
  });
});

// ---------------------------------------------------------------------------
// Metadata source
// ---------------------------------------------------------------------------

describe('computeSharedGames — metadata', () => {
  it('takes name/iconUrl/headerUrl from user A', () => {
    const iconA = 'icon-a.jpg';
    const headerA = 'https://cdn.akamai.steamstatic.com/steam/apps/1/custom-header.jpg';
    const a = [game(1, 'NameFromA', 100, { iconUrl: iconA, headerUrl: headerA })];
    const b = [game(1, 'NameFromB', 80, { iconUrl: 'icon-b.jpg' })];
    const [r] = computeSharedGames(a, b);
    expect(r?.name).toBe('NameFromA');
    expect(r?.iconUrl).toBe(iconA);
    expect(r?.headerUrl).toBe(headerA);
  });

  it("falls back to B's name when A's name is an empty string", () => {
    const a = [game(1, '', 100)];
    const b = [game(1, 'NameFromB', 80)];
    const [r] = computeSharedGames(a, b);
    expect(r?.name).toBe('NameFromB');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('computeSharedGames — edge cases', () => {
  it('returns [] when A is empty', () => {
    expect(computeSharedGames([], [game(1, 'G', 10)])).toEqual([]);
  });

  it('returns [] when B is empty', () => {
    expect(computeSharedGames([game(1, 'G', 10)], [])).toEqual([]);
  });

  it('returns [] when both inputs are empty', () => {
    expect(computeSharedGames([], [])).toEqual([]);
  });

  it('handles duplicate appIds within one input without crashing (last wins)', () => {
    // Both entries for appId=1 in A — last one (200 min) should win.
    const a = [game(1, 'First', 100), game(1, 'Last', 200)];
    const b = [game(1, 'G', 50)];
    const result = computeSharedGames(a, b);
    expect(result).toHaveLength(1);
    expect(result[0]?.playtimeA).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('computeSharedGames — immutability', () => {
  it('does not mutate user A input', () => {
    const a = [game(1, 'A', 100), game(2, 'B', 50)];
    const b = [game(1, 'A', 80)];
    const before = a.map((g) => g.appId);
    computeSharedGames(a, b);
    expect(a.map((g) => g.appId)).toEqual(before);
  });

  it('does not mutate user B input', () => {
    const a = [game(1, 'A', 100)];
    const b = [game(1, 'A', 80), game(2, 'B', 60)];
    const before = b.map((g) => g.appId);
    computeSharedGames(a, b);
    expect(b.map((g) => g.appId)).toEqual(before);
  });
});
