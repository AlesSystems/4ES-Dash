import { describe, expect, it } from 'vitest';
import {
  acquisitionDatesUnavailable,
  filterGames,
  parseSortKey,
  sortGames,
  toLibraryTile,
  type LibraryGame,
} from '@/lib/games/sort';

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

const games: LibraryGame[] = [
  game({ appId: 1, name: 'Bravo', playtime: { total: 100, twoWeeks: 0 } }),
  game({ appId: 2, name: 'alpha', playtime: { total: 100, twoWeeks: 30 } }),
  game({ appId: 3, name: 'Charlie', playtime: { total: 500, twoWeeks: 10 } }),
];

describe('parseSortKey', () => {
  it('defaults to playtime for missing/invalid values', () => {
    expect(parseSortKey(null)).toBe('playtime');
    expect(parseSortKey('bogus')).toBe('playtime');
  });
  it('accepts valid keys', () => {
    expect(parseSortKey('name')).toBe('name');
    expect(parseSortKey('recent')).toBe('recent');
    expect(parseSortKey('added')).toBe('added');
  });
});

describe('sortGames', () => {
  it('playtime desc, ties broken by name asc (case-insensitive)', () => {
    const r = sortGames(games, 'playtime').map((g) => g.appId);
    expect(r).toEqual([3, 2, 1]); // Charlie(500), then alpha & Bravo tie at 100 → alpha first
  });
  it('name asc case-insensitive', () => {
    expect(sortGames(games, 'name').map((g) => g.name)).toEqual(['alpha', 'Bravo', 'Charlie']);
  });
  it('recent: two-week minutes desc, unplayed sink below', () => {
    expect(sortGames(games, 'recent').map((g) => g.appId)).toEqual([2, 3, 1]);
  });
  it('does not mutate the input', () => {
    const before = games.map((g) => g.appId);
    sortGames(games, 'name');
    expect(games.map((g) => g.appId)).toEqual(before);
  });
  it('added: known dates asc first, then null by name', () => {
    const withDates: LibraryGame[] = [
      game({ appId: 10, name: 'Zeta', acquiredAt: '2020-01-01T00:00:00.000Z' }),
      game({ appId: 11, name: 'Yanny', acquiredAt: null }),
      game({ appId: 12, name: 'Xavier', acquiredAt: '2019-01-01T00:00:00.000Z' }),
    ];
    expect(sortGames(withDates, 'added').map((g) => g.appId)).toEqual([12, 10, 11]);
  });
});

describe('filterGames', () => {
  it('case-insensitive substring match; blank returns all', () => {
    expect(
      filterGames(games, 'a')
        .map((g) => g.appId)
        .sort(),
    ).toEqual([1, 2, 3]);
    expect(filterGames(games, 'char').map((g) => g.appId)).toEqual([3]);
    expect(filterGames(games, '   ')).toHaveLength(3);
  });
});

describe('toLibraryTile', () => {
  it('toLibraryTile strips non-tile fields', () => {
    const full = game({
      appId: 42,
      name: 'Deep Rock',
      playtime: { total: 120, twoWeeks: 30 },
      hasAchievements: true,
      iconUrl: 'https://media.steampowered.com/icon.jpg',
      lastPlayed: '2026-07-01T00:00:00.000Z',
      acquiredAt: '2025-01-01T00:00:00.000Z',
    });
    const tile = toLibraryTile(full);
    expect(Object.keys(tile).sort()).toEqual(
      ['appId', 'name', 'headerUrl', 'hasAchievements', 'playtime'].sort(),
    );
    expect(Object.keys(tile.playtime).sort()).toEqual(['total', 'twoWeeks'].sort());
    expect(tile).toEqual({
      appId: 42,
      name: 'Deep Rock',
      headerUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/42/header.jpg',
      hasAchievements: true,
      playtime: { total: 120, twoWeeks: 30 },
    });
  });
});

describe('acquisitionDatesUnavailable', () => {
  it('true when every game lacks acquiredAt', () => {
    expect(acquisitionDatesUnavailable(games)).toBe(true);
  });
  it('false when at least one has a date', () => {
    expect(
      acquisitionDatesUnavailable([game({ appId: 9, name: 'Q', acquiredAt: '2020-01-01' })]),
    ).toBe(false);
  });
});
