# Wayline — Bug #2: Year in Review shows 0 / tiny hours for 2026

**Confidence: 5/5** · Status: root-caused, ready to seed fix loop

## Symptom

> Year in Review page shows 0 hours or a small amount of hours under 2026, which
> is not accurate.

## Root cause

YIR computes *within-year* playtime as a snapshot delta —
`Σ over games of (max(playtimeForever) − min(playtimeForever))` taken **only over
snapshots whose UTC year already equals the target year** — but no Jan-1
(or prior-year) baseline snapshot is ever created. So for 2026 the `min` is the
**cumulative lifetime total** captured on the *first snapshot of 2026* (≈ project
start, mid-2026). The subtraction throws away every hour played before snapshotting
began, leaving only the few weeks since — and exactly **0** when a game has just one
2026 snapshot.

It's the inverse of a cumulative-vs-delta bug: instead of over-counting by using
`playtimeForever` directly, it **under-counts/zeroes by subtracting the in-year
cumulative floor.**

## Evidence

| Link | Location | Finding |
|---|---|---|
| Page empty-gate | [app/review/[year]/page.tsx:54-58](../../app/review/[year]/page.tsx#L54) | `totalMinutes===0 && topGames.length===0 && achievementsUnlocked===0` → "No data for {year}". |
| Repo query | [server/repositories/insights/year-in-review.ts:38-41](../../server/repositories/insights/year-in-review.ts#L38) | `findMany({ where:{ steamId }, select:{ appId,date,playtimeForever } })` — **no prior-year reach-back, no date filter.** |
| **The defect** | [lib/insights/year-in-review.ts:89-113](../../lib/insights/year-in-review.ts#L89) | `:97` `if (row.date.getUTCFullYear() !== year) continue;` discards out-of-year rows *before* min/max; `:110` `deltas.set(appId, Math.max(0, max−min))`. `min` = earliest **in-year** cumulative value. |
| Total | [lib/insights/year-in-review.ts:149-155](../../lib/insights/year-in-review.ts#L149) | `totalMinutes` = Σ clamped in-year deltas. |
| No baseline seeded | [server/jobs/onboarding-backfill.ts:161-170](../../server/jobs/onboarding-backfill.ts#L161), [server/jobs/snapshot.ts:140-145](../../server/jobs/snapshot.ts#L140) | Onboarding seeds one snapshot for *today*; nightly writes *today only*. No historical backfill → earliest snapshot = onboarding day. |
| Tests enshrine the bug | [tests/unit/insights-year-in-review.test.ts:122-133, 135-141](../../tests/unit/insights-year-in-review.test.ts#L122) | A `2024-12-31` baseline of 100 + in-year 200→350 asserts **150 (350−200), not 250**; single in-year snapshot asserts `totalMinutes` **0**. |
| Seed reproduces it | [prisma/seed-data.ts:18](../../prisma/seed-data.ts#L18) | `SEED_DAYS = 60`; with today = 2026-06-30 the earliest 2026 snapshot ≈ May 1 → 2026 delta spans ≤60 days, never Jan 1→today. |
| Year boundary is CORRECT | tests `:243-269` | Consistent `getUTCFullYear`; the failure is the **missing baseline**, not a date-parse off-by-one. |

## Data-flow trace (with the exact arithmetic)

```
/review/2026 (app/review/[year]/page.tsx:40)  year = 2026
  → getYearInReview(steamId, 2026)             server/repositories/insights/year-in-review.ts:47
  → playtimeRows = ALL user snapshots          :38-41  (earliest = onboarding day, value = LIFETIME total)
  → computeYearInReview(2026, rows, …)          lib/insights/year-in-review.ts:149
  → deltasByApp keeps only 2026 rows            :96-106
       min = cumulative on first 2026 snap ≈ 50 000 min  ← year-start LIFETIME floor (wrong baseline)
       max = cumulative today               ≈ 50 600 min
  → delta = max(0, 50 600 − 50 000) = 600 min  :110   ← only ~10h since onboarding, not Jan 1→now
       (single 2026 snapshot ⇒ min===max ⇒ delta 0)
  → totalMinutes = Σ tiny/zero deltas           :153-155
  → page: small/inaccurate hours, or "No data for 2026" if all zero
```

## Why it fails (the class of error)

The code treats "hours played in year Y" as `max − min` over snapshots **inside**
year Y, silently assuming the dataset holds a snapshot at/before the year's start
carrying the year-start cumulative total. True for a fully-historical year; **false
for the current year of a freshly-launched project**. Because `playtimeForever` is
monotonic/cumulative ([prisma/schema.prisma:109](../../prisma/schema.prisma#L109)),
using the first in-year snapshot as `min` subtracts away all pre-snapshot hours. The
correct baseline (last snapshot of 2025, or 0) is explicitly discarded by the
`getUTCFullYear() !== year` filter at
[lib/insights/year-in-review.ts:97](../../lib/insights/year-in-review.ts#L97).

## Blast radius

- **Bug #1 (History)** shares the identical per-period `max − min` convention
  ([lib/history/aggregate.ts:156-170](../../lib/history/aggregate.ts#L156)); the
  first week/month bucket is under-counted the same way. YIR is the whole-year
  instance. See [bug-1-history-no-data.md](bug-1-history-no-data.md).
- **`acquiredAt` / library "added" sort** — [server/repositories/snapshots.ts:29-47](../../server/repositories/snapshots.ts#L29): games owned before snapshotting show `acquiredAt: null`.
- **`server/repositories/insights/idle.ts`** also reads `playtimeSnapshot` — may share the baseline assumption; follow-up check.
- **Already-immune sibling (the fix template):** achievements count
  ([lib/insights/year-in-review.ts:70-79](../../lib/insights/year-in-review.ts#L70))
  is correct because **ERR-0009 / #91** moved it off snapshot-deltas onto real
  `AchievementUnlock` `unlockedAt` events.

## Fix direction (described, not implemented)

Mirror how ERR-0009 fixed achievements — make yearly playtime a true cross-boundary
diff with a baseline:

1. **Provide a year-start baseline.** In the repository, for each app fetch the last
   snapshot **strictly before Jan 1** of the target year as the starting cumulative
   value, and the last snapshot on/before Dec 31 (or latest, for the current year) as
   the end. Yearly minutes = Σ `max(0, end − baseline)`. Change `deltasByApp`
   ([lib/insights/year-in-review.ts:89-113](../../lib/insights/year-in-review.ts#L89))
   to accept a `baselineByApp: Map<number, number>` rather than deriving `min` from
   in-year rows.
2. **Honest partial-year handling** when no pre-year baseline exists (genuine
   "snapshots started mid-year"): use the first in-year snapshot as baseline **and
   surface a "partial year — tracking began {date}" caveat** (like the `acquiredAt:
   null` note), or fall back to the first-ever snapshot. Stop silently discarding the
   prior-year row at `:97`.
3. **Optionally seed a baseline at onboarding** so future years are correct from day
   one — but this can't retroactively fix elapsed 2026, so (1)+(2) are the real fix.
4. **Update the tests** ([:122-133, :135-141](../../tests/unit/insights-year-in-review.test.ts#L122)) which currently *enshrine* the under-counting, to assert the prior-year baseline is used.

## → Agentic loop seed

- **Brief intent:** "Year in Review reports true Jan 1→now hours for the current
  year, using a pre-year baseline; when no baseline exists it shows a partial-year
  caveat instead of a misleadingly small/zero number."
- **Acceptance criteria (testable):**
  - Given a `2025-12-31` snapshot of 100 and 2026 snapshots 200→350, 2026 total =
    **250** (not 150).
  - Given only mid-2026 snapshots, total reflects available range **and** the UI
    renders a "tracking began {date}" caveat.
  - Single in-year snapshot no longer silently yields 0 for an owned, played game.
- **Task split:** (a) repo baseline reach-back query; (b) `deltasByApp` baseline
  param; (c) UI caveat; (d) rewrite the two enshrining tests.
- **Reviewer checks:** confirm baseline is the *prior-year* snapshot, not in-year
  floor; confirm partial-year caveat path; cross-check History (bug #1) wasn't
  regressed by any shared aggregate change.
- **ERROR.md:** append `ERR-0018` — "YIR playtime sibling to ERR-0009: in-year
  snapshot floor used as baseline, under-counts current year."
