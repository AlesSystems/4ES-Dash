# Task 01 — streak calculation (pure) (EXAMPLE)

**Status owner:** implementer · **Depends on:** none · **Blocks:** Task 02

## Scope (exactly these files)

- `lib/stats/streak.ts` (new)
- `tests/unit/streak.test.ts` (new)

Touch nothing else. If you need to change a file outside this list, STOP and
report — it's a planning gap, not your call.

## Contract (from 02-architecture.md — do not redesign)

```ts
export interface SnapshotDay { date: string; playtimeForever: number }
export interface StreakResult { longest: number; current: number }
export function computeStreak(days: SnapshotDay[]): StreakResult;
```

## Acceptance criteria (each maps to at least one test)

1. Empty input `[]` → `{ longest: 0, current: 0 }`.
2. Single day → `{ longest: 0, current: 0 }` (a streak needs an increase vs. a
   prior day).
3. Three ascending days each with an increase → `{ longest: 2, current: 2 }`
   (2 transitions, both counted).
4. A day with equal `playtimeForever` (no play) breaks the streak: increase,
   equal, increase → `{ longest: 1, current: 1 }`.
5. `current` reflects only the streak ending on the most recent day, even when
   an earlier streak was longer.
6. Function is pure: no imports from `server/`, no I/O, no mutation of input.

## Definition of done for this task

- Failing tests written first (TDD), then green.
- The PostToolUse gate passes (related tests + `tsc --noEmit`).
- `state.json` task `01` set to `in-review` with the test file listed.
- Reviewer returns APPROVE.
