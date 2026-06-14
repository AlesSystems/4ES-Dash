import { describe, expect, it } from 'vitest';
import type { OwnedGame } from '@/lib/steam/schemas';
import { topGamesByPlaytime } from '@/lib/games/select';

function game(appId: number, name: string, total: number): OwnedGame {
  return {
    appId,
    name,
    iconUrl: null,
    headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    playtime: { total, twoWeeks: 0 },
    lastPlayed: null,
    hasAchievements: false,
  };
}

describe('topGamesByPlaytime', () => {
  it('returns at most `limit` games, sorted by playtime descending', () => {
    const games = Array.from({ length: 12 }, (_, i) => game(i + 1, `Game ${i + 1}`, (i + 1) * 100));
    const top = topGamesByPlaytime(games, 10);

    expect(top).toHaveLength(10);
    expect(top[0]?.playtime.total).toBe(1200);
    expect(top[9]?.playtime.total).toBe(300);
    // descending throughout
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1]!.playtime.total).toBeGreaterThanOrEqual(top[i]!.playtime.total);
    }
  });

  it('returns all games when fewer than the limit (no padding)', () => {
    const games = [game(1, 'A', 10), game(2, 'B', 20)];
    expect(topGamesByPlaytime(games, 10)).toHaveLength(2);
  });

  it('breaks playtime ties by name ascending and does not mutate input', () => {
    const games = [game(1, 'Zeta', 100), game(2, 'Alpha', 100)];
    const top = topGamesByPlaytime(games, 10);
    expect(top.map((g) => g.name)).toEqual(['Alpha', 'Zeta']);
    expect(games[0]?.name).toBe('Zeta'); // original order untouched
  });
});
