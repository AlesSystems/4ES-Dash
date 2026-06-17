import { describe, it, expect } from 'vitest';
import { rankCostPerHour, MIN_HOURS, type CostInput } from '@/lib/insights/cost-per-hour';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function paid(
  appId: number,
  name: string,
  playtimeMinutes: number,
  cents: number,
  currency = 'USD',
): CostInput {
  return { appId, name, playtimeMinutes, price: { kind: 'paid', cents, currency } };
}

function free(appId: number, name: string, playtimeMinutes: number): CostInput {
  return { appId, name, playtimeMinutes, price: { kind: 'free' } };
}

function unavailable(appId: number, name: string, playtimeMinutes: number): CostInput {
  return { appId, name, playtimeMinutes, price: { kind: 'unavailable' } };
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('rankCostPerHour — empty input', () => {
  it('returns empty result for empty array', () => {
    expect(rankCostPerHour([])).toEqual({
      ranked: [],
      freeGames: [],
      excludedNoPlaytime: 0,
      excludedNoPrice: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Single paid game
// ---------------------------------------------------------------------------

describe('rankCostPerHour — single paid game', () => {
  it('computes cost-per-hour using raw (un-rounded) hours', () => {
    // 90 min = 1.5 h; $10.00 = 1000 cents; 1000 / 1.5 = 667 (rounded)
    const result = rankCostPerHour([paid(1, 'Game A', 90, 1000)]);
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0]?.playtimeHours).toBe(1.5);
    expect(result.ranked[0]?.costPerHourCents).toBe(667);
    expect(result.freeGames).toHaveLength(0);
    expect(result.excludedNoPlaytime).toBe(0);
    expect(result.excludedNoPrice).toBe(0);
  });

  it('clamps hours to MIN_HOURS for very low playtime', () => {
    // 1 min = 1/60 h ≈ 0.0167 → clamped to MIN_HOURS (0.1)
    // $5.00 = 500 cents; 500 / 0.1 = 5000
    const result = rankCostPerHour([paid(1, 'Barely Played', 1, 500)]);
    expect(result.ranked[0]?.costPerHourCents).toBe(5000);
    expect(result.ranked[0]?.playtimeHours).toBe(0); // 1/60 rounds to 0.0
  });

  it('excludes paid game with 0 playtime', () => {
    const result = rankCostPerHour([paid(1, 'Unplayed', 0, 1000)]);
    expect(result.ranked).toHaveLength(0);
    expect(result.excludedNoPlaytime).toBe(1);
  });

  it('excludes paid game with negative playtime', () => {
    const result = rankCostPerHour([paid(1, 'Negative', -5, 1000)]);
    expect(result.excludedNoPlaytime).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Free and unavailable games
// ---------------------------------------------------------------------------

describe('rankCostPerHour — free and unavailable games', () => {
  it('puts free games in freeGames bucket regardless of playtime', () => {
    const result = rankCostPerHour([free(1, 'Free Game', 0), free(2, 'Another Free', 120)]);
    expect(result.freeGames).toHaveLength(2);
    expect(result.ranked).toHaveLength(0);
  });

  it('sorts free games by playtimeMinutes desc', () => {
    const result = rankCostPerHour([free(1, 'Less', 60), free(2, 'More', 300)]);
    expect(result.freeGames[0]?.appId).toBe(2);
    expect(result.freeGames[1]?.appId).toBe(1);
  });

  it('counts unavailable-price games in excludedNoPrice', () => {
    const result = rankCostPerHour([unavailable(1, 'Mystery', 100)]);
    expect(result.excludedNoPrice).toBe(1);
    expect(result.ranked).toHaveLength(0);
    expect(result.freeGames).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-game ranking
// ---------------------------------------------------------------------------

describe('rankCostPerHour — multi-game ranking', () => {
  it('sorts ranked list by costPerHourCents DESC (most expensive first)', () => {
    const result = rankCostPerHour([
      paid(1, 'Cheap', 600, 500), // 600 min = 10h; $5 → 50 c/h
      paid(2, 'Expensive', 60, 2000), // 60 min = 1h; $20 → 2000 c/h
      paid(3, 'Mid', 120, 600), // 120 min = 2h; $6 → 300 c/h
    ]);
    const ids = result.ranked.map((r) => r.appId);
    expect(ids).toEqual([2, 3, 1]);
  });

  it('handles mix of paid, free, and unavailable in one call', () => {
    const result = rankCostPerHour([
      paid(1, 'AAA', 60, 6000),
      free(2, 'F2P', 500),
      unavailable(3, 'Unknown', 200),
      paid(4, 'Indie', 180, 1000),
      paid(5, 'No Play', 0, 800),
    ]);
    expect(result.ranked).toHaveLength(2);
    expect(result.freeGames).toHaveLength(1);
    expect(result.excludedNoPrice).toBe(1);
    expect(result.excludedNoPlaytime).toBe(1);
  });

  it('playtimeHours rounds to 1 decimal', () => {
    // 95 min / 60 = 1.5833... → rounds to 1.6
    const result = rankCostPerHour([paid(1, 'Game', 95, 1000)]);
    expect(result.ranked[0]?.playtimeHours).toBe(1.6);
  });

  it('preserves currency from price input', () => {
    const result = rankCostPerHour([paid(1, 'EU Game', 120, 1499, 'EUR')]);
    expect(result.ranked[0]?.currency).toBe('EUR');
    expect(result.ranked[0]?.priceCents).toBe(1499);
  });
});

// ---------------------------------------------------------------------------
// MIN_HOURS constant
// ---------------------------------------------------------------------------

describe('MIN_HOURS constant', () => {
  it('is exported and equals 0.1', () => {
    expect(MIN_HOURS).toBe(0.1);
  });
});
