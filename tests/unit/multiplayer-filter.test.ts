/**
 * Unit tests for lib/games/multiplayer.ts (issue #32).
 * Pure logic — no HTTP mocking needed.
 */

import { describe, expect, it } from 'vitest';
import {
  filterToMultiplayer,
  isMultiplayerGame,
  parseMultiplayerParam,
} from '@/lib/games/multiplayer';
import type { LibraryGame } from '@/lib/games/sort';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function game(partial: Partial<LibraryGame> & { appId: number; name: string }): LibraryGame {
  return {
    iconUrl: null,
    headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${partial.appId}/header.jpg`,
    playtime: { total: 0, twoWeeks: 0 },
    lastPlayed: null,
    hasAchievements: false,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// isMultiplayerGame
// ---------------------------------------------------------------------------

describe('isMultiplayerGame', () => {
  it('returns true for categoryId 1 (Multi-player)', () => {
    expect(isMultiplayerGame([1])).toBe(true);
  });

  it('returns true for categoryId 9 (Co-op)', () => {
    expect(isMultiplayerGame([9])).toBe(true);
  });

  it('returns true for categoryId 27 (Cross-Platform Multiplayer)', () => {
    expect(isMultiplayerGame([27])).toBe(true);
  });

  it('returns true when one of multiple ids is a multiplayer id', () => {
    expect(isMultiplayerGame([1, 2])).toBe(true);
  });

  it('returns false when no multiplayer id is present', () => {
    expect(isMultiplayerGame([2, 3])).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(isMultiplayerGame([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isMultiplayerGame(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isMultiplayerGame(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseMultiplayerParam
// ---------------------------------------------------------------------------

describe('parseMultiplayerParam', () => {
  it('returns true for "1"', () => {
    expect(parseMultiplayerParam('1')).toBe(true);
  });

  it('returns true for "true"', () => {
    expect(parseMultiplayerParam('true')).toBe(true);
  });

  it('returns false for "0"', () => {
    expect(parseMultiplayerParam('0')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(parseMultiplayerParam('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(parseMultiplayerParam(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(parseMultiplayerParam(undefined)).toBe(false);
  });

  it('returns false for an arbitrary string', () => {
    expect(parseMultiplayerParam('x')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterToMultiplayer
// ---------------------------------------------------------------------------

describe('filterToMultiplayer', () => {
  const games: LibraryGame[] = [
    game({ appId: 620, name: 'Portal 2' }),
    game({ appId: 570, name: 'Dota 2' }),
    game({ appId: 730, name: 'CS2' }),
  ];

  it('keeps only games whose appId is in the set', () => {
    const result = filterToMultiplayer(games, new Set([620, 730]));
    expect(result.map((g) => g.appId)).toEqual([620, 730]);
  });

  it('returns empty array when set is empty', () => {
    expect(filterToMultiplayer(games, new Set())).toEqual([]);
  });

  it('returns empty array when no game appId is in the set', () => {
    expect(filterToMultiplayer(games, new Set([999]))).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const before = games.map((g) => g.appId);
    filterToMultiplayer(games, new Set([620]));
    expect(games.map((g) => g.appId)).toEqual(before);
  });
});
