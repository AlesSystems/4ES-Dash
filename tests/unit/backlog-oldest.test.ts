import { describe, expect, it } from 'vitest';
import { oldestUnplayed } from '@/lib/games/backlog';
import type { LibraryGame } from '@/lib/games/sort';

/** Minimal factory for LibraryGame test fixtures. */
function game(partial: {
  appId: number;
  name: string;
  playtimeTotal?: number;
  acquiredAt?: string | null;
}): LibraryGame {
  return {
    appId: partial.appId,
    name: partial.name,
    iconUrl: null,
    headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${partial.appId}/header.jpg`,
    playtime: { total: partial.playtimeTotal ?? 0, twoWeeks: 0 },
    lastPlayed: null,
    hasAchievements: false,
    acquiredAt: partial.acquiredAt ?? null,
  };
}

describe('oldestUnplayed', () => {
  it('returns null when there are no games', () => {
    expect(oldestUnplayed([])).toBeNull();
  });

  it('returns null when all games have been played', () => {
    const games = [
      game({ appId: 1, name: 'Alpha', playtimeTotal: 120 }),
      game({ appId: 2, name: 'Beta', playtimeTotal: 5 }),
    ];
    expect(oldestUnplayed(games)).toBeNull();
  });

  it('ignores played games and returns the only unplayed game', () => {
    const games = [
      game({ appId: 1, name: 'Played', playtimeTotal: 300 }),
      game({ appId: 2, name: 'Unplayed', playtimeTotal: 0, acquiredAt: '2021-05-01' }),
    ];
    expect(oldestUnplayed(games)).toEqual({ name: 'Unplayed', acquiredAt: '2021-05-01' });
  });

  it('picks the earliest known acquiredAt among unplayed games', () => {
    const games = [
      game({ appId: 1, name: 'Newer', playtimeTotal: 0, acquiredAt: '2022-06-15' }),
      game({ appId: 2, name: 'Older', playtimeTotal: 0, acquiredAt: '2019-01-01' }),
      game({ appId: 3, name: 'Middle', playtimeTotal: 0, acquiredAt: '2021-03-10' }),
    ];
    expect(oldestUnplayed(games)).toEqual({ name: 'Older', acquiredAt: '2019-01-01' });
  });

  it('known acquiredAt beats null acquiredAt', () => {
    const games = [
      game({ appId: 1, name: 'NoDate', playtimeTotal: 0, acquiredAt: null }),
      game({ appId: 2, name: 'HasDate', playtimeTotal: 0, acquiredAt: '2023-03-01' }),
    ];
    expect(oldestUnplayed(games)).toEqual({ name: 'HasDate', acquiredAt: '2023-03-01' });
  });

  it('falls back to name ascending when all acquiredAt are null', () => {
    const games = [
      game({ appId: 1, name: 'Zephyr', playtimeTotal: 0, acquiredAt: null }),
      game({ appId: 2, name: 'alpha', playtimeTotal: 0, acquiredAt: null }),
      game({ appId: 3, name: 'Bravo', playtimeTotal: 0, acquiredAt: null }),
    ];
    // localeCompare with sensitivity:'base' → alpha < Bravo < Zephyr
    expect(oldestUnplayed(games)).toEqual({ name: 'alpha', acquiredAt: null });
  });

  it('null acquiredAt is normalised to null (not undefined) in the return value', () => {
    const games = [game({ appId: 1, name: 'Solo', playtimeTotal: 0 })];
    const result = oldestUnplayed(games);
    expect(result).not.toBeNull();
    expect(result!.acquiredAt).toBeNull();
  });

  it('with identical acquiredAt dates, picks the earlier name', () => {
    const games = [
      game({ appId: 1, name: 'Zeta', playtimeTotal: 0, acquiredAt: '2020-01-01' }),
      game({ appId: 2, name: 'Alpha', playtimeTotal: 0, acquiredAt: '2020-01-01' }),
    ];
    // Tie on date → name asc → Alpha wins
    expect(oldestUnplayed(games)!.name).toBe('Alpha');
  });
});
