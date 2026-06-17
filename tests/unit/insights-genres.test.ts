import { describe, it, expect } from 'vitest';
import { aggregateBreakdown, type BreakdownItem } from '@/lib/insights/genres';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function item(labels: string[], minutes: number): BreakdownItem {
  return { labels, minutes };
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('aggregateBreakdown — empty input', () => {
  it('returns empty slices and zero total for empty array', () => {
    expect(aggregateBreakdown([])).toEqual({ slices: [], totalMinutes: 0 });
  });
});

// ---------------------------------------------------------------------------
// Single game — happy path
// ---------------------------------------------------------------------------

describe('aggregateBreakdown — single game', () => {
  it('produces one slice for a game with one label', () => {
    const result = aggregateBreakdown([item(['RPG'], 120)]);
    expect(result.totalMinutes).toBe(120);
    expect(result.slices).toEqual([{ label: 'RPG', minutes: 120, percent: 100 }]);
  });

  it('produces one Unknown slice when game has no labels', () => {
    const result = aggregateBreakdown([item([], 90)]);
    expect(result.totalMinutes).toBe(90);
    expect(result.slices).toEqual([{ label: 'Unknown', minutes: 90, percent: 100 }]);
  });

  it('respects custom unknownLabel', () => {
    const result = aggregateBreakdown([item([], 60)], 'Uncategorised');
    expect(result.slices[0]?.label).toBe('Uncategorised');
  });
});

// ---------------------------------------------------------------------------
// Multi-label game (genre overlap)
// ---------------------------------------------------------------------------

describe('aggregateBreakdown — multi-label game', () => {
  it('counts full minutes in each label for a two-label game', () => {
    const result = aggregateBreakdown([item(['Action', 'RPG'], 200)]);
    expect(result.totalMinutes).toBe(200); // counted once
    const action = result.slices.find((s) => s.label === 'Action');
    const rpg = result.slices.find((s) => s.label === 'RPG');
    expect(action?.minutes).toBe(200);
    expect(rpg?.minutes).toBe(200);
    // Both have 100 % of the total — slices can sum > 100 %
    expect(action?.percent).toBe(100);
    expect(rpg?.percent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Multi-game breakdown
// ---------------------------------------------------------------------------

describe('aggregateBreakdown — multiple games', () => {
  it('accumulates minutes for shared labels across games', () => {
    const result = aggregateBreakdown([item(['RPG'], 300), item(['RPG', 'Strategy'], 100)]);
    expect(result.totalMinutes).toBe(400);
    const rpg = result.slices.find((s) => s.label === 'RPG');
    const strategy = result.slices.find((s) => s.label === 'Strategy');
    expect(rpg?.minutes).toBe(400); // 300 + 100
    expect(strategy?.minutes).toBe(100);
  });

  it('sorts slices by minutes desc, ties broken by label asc', () => {
    const result = aggregateBreakdown([
      item(['Bravo'], 100),
      item(['Alpha'], 100),
      item(['Zeta'], 200),
    ]);
    expect(result.slices.map((s) => s.label)).toEqual(['Zeta', 'Alpha', 'Bravo']);
  });

  it('mixes labelled and unlabelled games into the Unknown bucket', () => {
    const result = aggregateBreakdown([item(['Action'], 100), item([], 50)]);
    expect(result.totalMinutes).toBe(150);
    const unknown = result.slices.find((s) => s.label === 'Unknown');
    expect(unknown?.minutes).toBe(50);
  });

  it('computes percent correctly for mixed minutes', () => {
    const result = aggregateBreakdown([item(['A'], 60), item(['B'], 240)]);
    // A: 60/300 = 20 %, B: 240/300 = 80 %
    expect(result.totalMinutes).toBe(300);
    const a = result.slices.find((s) => s.label === 'A');
    const b = result.slices.find((s) => s.label === 'B');
    expect(a?.percent).toBeCloseTo(20, 1);
    expect(b?.percent).toBeCloseTo(80, 1);
  });

  it('returns percent 0 when totalMinutes is 0', () => {
    const result = aggregateBreakdown([item(['RPG'], 0)]);
    expect(result.totalMinutes).toBe(0);
    expect(result.slices[0]?.percent).toBe(0);
  });
});
