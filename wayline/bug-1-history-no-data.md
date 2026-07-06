# Wayline — Bug #1: History shows no data even for daily players

**Confidence: 5/5** · Status: root-caused, ready to seed fix loop

## Symptom

> History shows no data even for users who play daily games on Steam.

The `/history` page renders "History is still building" / "No history yet"
instead of a chart, even for an actively-playing account.

## Root cause

History is empty because `aggregatePlaytime` buckets day-keyed snapshots into
**whole ISO weeks / calendar months**, so until the user's snapshot history spans
**two distinct periods**, the function returns fewer than 2 points and
[`app/history/page.tsx`](../../app/history/page.tsx) renders the empty state. The
chart needs ~7–14 days of accrued snapshots (and a working nightly cron) before it
can ever draw — regardless of how much the user plays.

## Evidence

| Link | Location | Finding |
|---|---|---|
| Page gate | [app/history/page.tsx:64](../../app/history/page.tsx#L64) | `points.length < 2` → "History is still building"; chart only at `:75-80`. **This is the user-facing failure point.** |
| Aggregation | [lib/history/aggregate.ts:139-192](../../lib/history/aggregate.ts#L139) | Per (game, period) tracks `{min,max}` (`:154-160`), period total `Σ(max−min)` (`:166-172`), emits **one point per period** (`:181-189`). |
| Proof (tests) | [tests/unit/history-aggregate.test.ts:102-105, 114-122](../../tests/unit/history-aggregate.test.ts#L102) | 3 daily rows in one ISO week → exactly one point, `length === 1`. |
| Repo query | [server/repositories/snapshots.ts:73-80](../../server/repositories/snapshots.ts#L73) | `findMany` filtered only by `steamId`, no date-range filter — returns every row. **Query is NOT the problem.** |
| steamId type | [prisma/schema.prisma:106](../../prisma/schema.prisma#L106) | `steamId String`, `@@id([steamId, appId, date])`. No number/BigInt coercion — refuted. |
| Writer/table match | [server/jobs/snapshot.ts:140-145](../../server/jobs/snapshot.ts#L140) | Writes `playtimeSnapshot.upsert`; reader reads same table/shape — refuted. |
| Cron IS scheduled | `vercel.json` + [app/api/cron/snapshot/route.ts:33-53](../../app/api/cron/snapshot/route.ts#L33) | Daily `0 3 * * *`, accepts Vercel Bearer or `x-cron-secret` — "cron never runs" refuted for normal deploy. |
| Day-1 baseline | [server/jobs/onboarding-backfill.ts:161-170](../../server/jobs/onboarding-backfill.ts#L161) | Onboarding seeds one snapshot/game → fresh user has rows, but all in **one** period. |

## Data-flow trace

```
/history RSC (app/history/page.tsx)
  → getViewerSteamId()                         server/auth.ts:281
  → getPlaytimeSnapshots(steamId)              server/repositories/snapshots.ts:73
  → prisma.playtimeSnapshot.findMany           (all rows, day-keyed)
  → aggregatePlaytime(rows, bucket)            lib/history/aggregate.ts:139
  → ✗ collapses all rows of same week/month into ONE point
  → points.length < 2  →  EMPTY STATE          app/history/page.tsx:64
```

Writer (independent): Vercel cron `0 3 * * *` → `runSnapshotForUser()` → one
`playtimeSnapshot` row per game per UTC day.

## Why it fails (the class of error)

The broken assumption is **"an active player should immediately see history."**
Two structural facts make that impossible early:

1. Snapshots are keyed by **day**, but history is bucketed by **week/month** — a
   chart needs **≥2 distinct periods**, so it stays empty until snapshots straddle
   a week boundary (worst case ~13 days) or month boundary (up to ~30 days).
2. Playtime-in-period is a **delta of a cumulative counter** (`max − min` within
   the period). This is the exact anti-pattern in **ERR-0009's** generalized rule
   ([docs/ERROR.md:257](../ERROR.md)): *a delta needs ≥2 samples bracketing the
   window and silently returns 0/empty when history is sparse.* Acknowledged for
   playtime ([docs/ERROR.md:259](../ERROR.md)) but never fixed for this view.

## Blast radius

- **Bug #2 (Year in Review)** shares this exact snapshot-delta blind spot — see
  [bug-2-year-in-review-zero-hours.md](bug-2-year-in-review-zero-hours.md). ERR-0009
  fixed *achievements* via an event table but explicitly left **playtime-gained**
  on the snapshot-delta model.
- **First-seen / `acquiredAt`** — [server/repositories/snapshots.ts:29-41](../../server/repositories/snapshots.ts#L29) and library `sort=added`: a brand-new account has only today's baseline, so acquisition dates are absent.
- **Onboarding gate not consulted** — `app/history/page.tsx` never calls
  `getOnboardingStatus()` (per ERR-0008's documented convention,
  [docs/ERROR.md:238](../ERROR.md)), so a signed-in-but-not-onboarded user gets
  "No history yet" instead of being routed to `/onboarding` — a **second, distinct**
  way history shows nothing.
- Any "in this period" metric derived from snapshot deltas (idle insights,
  library-value trends) shares the ≥2-sample requirement.

## Fix direction (described, not implemented)

Ranked, lowest-risk first:

1. **Make the chart drawable from day one** — change the `points.length < 2` gate
   ([app/history/page.tsx:64](../../app/history/page.tsx#L64)) so a single period
   renders, or aggregate by **day** for short spans and switch to week/month only
   once range exists. *(Highest leverage — removes the cliff for active players.)*
2. **Distinguish "still accruing" from "genuinely empty"** — add the
   `getOnboardingStatus()` gate to the history page (ERR-0008 convention):
   not-onboarded → `/onboarding`; onboarded-but-sparse → honest "1 of 2 weeks
   captured" state.
3. **Structural (per ERR-0009 rule)** — for "minutes played in a period," sum
   day-over-day increments instead of `max − min` of sparse samples.
4. **Config verify (not code)** — confirm `CRON_SECRET` is set on Vercel and the
   cron has fired (`JobRun` rows, [server/jobs/snapshot.ts:192](../../server/jobs/snapshot.ts#L192)); an unset secret → 401 → no accrual past the baseline, which *also* pins history at one period.

## → Agentic loop seed

- **Brief intent:** "An actively-playing onboarded user sees a history chart within
  their first session, and the empty state only appears when genuinely no snapshots
  exist."
- **Acceptance criteria (testable):**
  - Given ≥1 snapshot period, `/history` renders a chart (not the empty state).
  - Given a not-onboarded session, `/history` routes to `/onboarding`.
  - `aggregatePlaytime` exposes day-granularity for short spans; unit test:
    3 daily rows in one week → a drawable series.
- **Task split:** (a) gate + day-granularity in `aggregate.ts` + page; (b) onboarding
  gate on the page; (c) optional structural delta-sum refactor.
- **Reviewer checks:** no regression in `tests/unit/history-aggregate.test.ts`;
  verify the ≥2-period cliff is gone; confirm ERR-0009 rule applied, not just symptom.
- **ERROR.md:** append an `ERR-XXXX` for "week/month bucketing hides active-player
  history (delta-needs-2-samples + period cliff)."
