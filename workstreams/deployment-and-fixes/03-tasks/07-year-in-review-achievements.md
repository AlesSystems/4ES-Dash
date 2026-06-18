# Task 07 — Year in Review: achievements unlocked is 0 (#91)

**Status owner:** implementer · **Depends on:** none (but **serialize
`server/jobs/snapshot.ts` with Task 01**, before Task 02) · **Blocks:** Task 01/02
coordination on `snapshot.ts` · **Tier:** 1

## Scope (exactly these files)

- `prisma/schema.prisma` + one new migration — `AchievementUnlock` events table
- `server/jobs/snapshot.ts` — record per-achievement unlock events from
  `getGameAchievements` (**merge point** with Task 01 + Task 02)
- `lib/insights/year-in-review.ts` — count by `unlockedAt` UTC year, not snapshot delta
- `server/repositories/insights/year-in-review.ts` — feed unlock events, not
  `unlockedCount` deltas
- `server/jobs/onboarding-backfill.ts` — seed unlock events on first run (attribute by
  `unlockedAt`)
- `tests/unit/insights-repo-year-in-review.test.ts` — add the missing non-zero
  assertions

## Root cause (already traced — fix the cause)

The count is `max(unlockedCount) − min(unlockedCount)` among the year's
`AchievementSnapshot` rows; with ≤1 snapshot in the year (the common case — onboarding
seeds **no** achievement baseline) the delta is 0. The real per-achievement
`unlockedAt` (parsed in `lib/steam/achievements.ts` as unix seconds × 1000) is
discarded by the job, and only the top-20 games are snapshotted. The dashboard
counts unlocks live and is correct — the two surfaces disagree. The existing test
never asserts a non-zero count, so CI missed it.

## Acceptance criteria

1. Given achievements with `unlockedAt` in year Y across multiple games,
   `getYearInReview(steamId, Y).achievementsUnlocked` equals the count whose
   `unlockedAt` UTC year === Y (> 0).
2. **History-independent:** with a single day of data but achievements unlocked in Y,
   the count is > 0 (the regression test that would have caught this).
3. **Year boundary:** `2025-12-31T23:59:59Z` counts only in 2025; `2026-01-01T00:00:00Z`
   only in 2026 (both directions, UTC).
4. **Seconds-vs-ms:** a known Steam `unlocktime` (unix seconds) lands in the correct
   year (guards the `× 1000` conversion).
5. **Cross-check:** sum of per-year counts equals the dashboard's total `unlocked`
   over the covered games.
6. An unlock in a game **outside** the top-20-played set still contributes.

## Degraded / unavailable-data behavior

`unlocktime: 0` ("unlocked, time unknown") → excluded (never counted as 1970). Private
profile on the live path (ERR-0002) → degrade to `{ available: false }`, never crash.
Existing users' pre-table unlocks are attributed by `unlockedAt` on first job run so
prior years populate retroactively rather than showing 0.

## Definition of done for this task

- Failing tests first (incl. the non-zero + boundary cases); gate passes. The new
  migration is additive and immutable. Keep the unlock-event recording in the nightly
  job (not the request path).
- `docs/DATA_MODEL.md` updated for the new table; `docs/ERROR.md` gets an ERR-XXXX.
- `state.json` task `07` → `in-review` with the achievement-count tests listed.
  Reviewer returns APPROVE.
