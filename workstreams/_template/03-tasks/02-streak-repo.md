# Task 02 — repository read (snapshots → streak) (EXAMPLE)

**Status owner:** implementer · **Depends on:** Task 01 signature · **Blocks:** Task 03

## Scope (exactly these files)

- `server/repositories/streak.ts` (new)
- `tests/unit/streak-repo.test.ts` (new)

Import `computeStreak` from `lib/stats/streak`; do not reimplement it. Touch
nothing else — STOP and report if you need to.

## Contract (from 02-architecture.md)

```ts
export type StreakAvailability =
  | ({ available: true } & StreakResult)
  | { available: false; reason: "no-snapshots" | "single-day" };

export function getGameStreak(steamId: string, appId: number): Promise<StreakAvailability>;
```

## Acceptance criteria

1. Loads snapshot rows for `(steamId, appId)` **ordered ascending by date** and
   passes them to `computeStreak`.
2. Zero snapshot rows → `{ available: false, reason: "no-snapshots" }`.
3. Exactly one row → `{ available: false, reason: "single-day" }`.
4. ≥ 2 rows → `{ available: true, longest, current }` from `computeStreak`.
5. `steamId` handled as a `string` end to end; no `Number(steamId)` anywhere.
6. Prisma access is mocked in the test — no live DB assumptions beyond the
   ordered-rows contract. Server-only; never imported by a client component.

## Definition of done

TDD; gate green; `state.json` task `02` → `in-review`; reviewer APPROVE.
