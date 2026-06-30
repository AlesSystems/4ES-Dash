# Evidence — History page renders empty for active players until snapshots span ≥2 whole week/month periods

> Read-only adversarial root-cause verification · branch `docs/bug-waylines` · 2026-06-30
>
> **Bug ID:** `bug-1-history-no-data` · **Classification:** `confirmed-code-bug` · **Confidence:** 5/5
>
> **Reviewer verdict:** `approve` · **Ready for planning:** ✅ yes · **Revise rounds:** 1

## Root cause

aggregatePlaytime (lib/history/aggregate.ts:139-192) buckets day-keyed snapshot rows into whole ISO weeks / calendar months and emits exactly ONE {period,minutes} point per distinct period present in the data (the zero-fill loop at :180-189 only spans firstKey..lastKey, so a single period yields length 1). app/history/page.tsx:64 then short-circuits any `points.length < 2` result into the "History is still building" empty state. Consequently a freshly-onboarded but actively-playing user — whose snapshots (onboarding baseline + nightly cron) all fall inside one week/month until history straddles a period boundary (worst case ~13 days for week, ~30 for month) — never sees a chart no matter how many minutes were actually played within that single period. The within-period delta (max−min) IS computed correctly (:163-172), but a 1-element series can't draw. This is a structural period-cliff, not a data/query/writer problem (getPlaytimeSnapshots filters only by steamId, returns all rows). Secondary route: app/history/page.tsx never calls getOnboardingStatus(), so a signed-in-but-not-onboarded user (zero rows) falls into the `rows.length === 0` "No history yet" branch (:56) instead of being redirected to /onboarding per the ERR-0008 convention — a second, distinct way history shows nothing.

## Evidence — every item grounded in a file:line opened this run

| File | Line | Finding |
|------|------|---------|
| `app/history/page.tsx` | 64 | `points.length < 2 ?` gate renders the "History is still building" empty state; chart only reached in the else branch at :75-81. Confirmed exactly at the cited line — user-facing failure point. |
| `app/history/page.tsx` | 56 | `rows.length === 0 ?` renders "No history yet". With no getOnboardingStatus() import/call anywhere in the file, a not-onboarded session lands here instead of redirecting to /onboarding — the secondary empty route. |
| `app/history/page.tsx` | 14 | Imports aggregatePlaytime; grep confirms this page is the ONLY consumer of aggregatePlaytime in the repo. No getOnboardingStatus import present (contrast app/insights/genres/page.tsx:12). |
| `lib/history/aggregate.ts` | 166 | Per-period total = Σ(max−min) across games (:166-172); the delta IS computed, so a single period with play yields a non-zero `minutes` — but still only one point. |
| `lib/history/aggregate.ts` | 183 | Zero-fill loop runs `current = firstKey` while `current <= lastKey`; when all rows share one period, firstKey===lastKey, producing a length-1 array that trips the page guard. |
| `tests/unit/history-aggregate.test.ts` | 105 | Test asserts 2 rows in one month → `[{period:'2026-05', minutes:300}]` (length 1). Proves single-period → one point by design. |
| `tests/unit/history-aggregate.test.ts` | 122 | Test asserts 3 daily rows in one ISO week → `[{period:'2026-W02', minutes:150}]` (length 1) — exact single-period-collapse proof for the weekly bucket. |
| `server/repositories/snapshots.ts` | 75 | getPlaytimeSnapshots findMany filters only by steamId, selects appId/date/playtimeForever, ordered date asc — returns every row, no date-range filter. Query is not the cause; refutes a missing-data hypothesis. |
| `docs/ERROR.md` | 257 | ERR-0009 generalized rule: a delta of a cumulative counter needs ≥2 samples bracketing the window and silently returns 0 when history is sparse. Same class as the playtime period-cliff. |
| `docs/ERROR.md` | 259 | ERR-0009 explicitly flags playtime-gained for a single-snapshot window as sharing the ≤1-sample blind spot, left on the snapshot-delta model — confirms the seed's (a) thread. |
| `docs/ERROR.md` | 238 | ERR-0008 'Where else': history/year-in-review/library/insights should consult getOnboardingStatus() rather than inferring 'empty' from zero rows. History page does NOT — confirms the seed's (b) thread. |
| `server/onboarding-gate.ts` | 43 | getOnboardingStatus() exists (cheap onboardedAt read returning no-session\|not-onboarded\|onboarded). app/insights/genres/page.tsx:35 uses it; app/history/page.tsx does not. |

## Stale anchors (seed line numbers that drifted vs HEAD)

| File | Claimed line | Note |
|------|--------------|------|
| `prisma/schema.prisma` | 106 | Seed cites :106 as `steamId String, @@id([steamId, appId, date])`. Line 106 is only `steamId String` inside model PlaytimeSnapshot; the composite `@@id([steamId, appId, date])` is actually at line 113. The two facts were conflated onto one line — claim is substantively true but the line anchor for the @@id is off by 7 lines. |

## Blast radius

- app/history/page.tsx is the SOLE consumer of aggregatePlaytime — no dashboard sparkline or other chart shares this exact code path (grep-confirmed).
- lib/insights/year-in-review.ts + server/repositories/insights/year-in-review.ts: Bug #2 — playtime-gained for a year/month derived from snapshot deltas shares the same ≤1-sample blind spot (ERR-0009:259); achievements were moved to an AchievementUnlock event table but playtime-gained was explicitly left on the snapshot-delta model.
- app/insights/idle.ts / lib/insights/idle.ts: any 'in this period' idle metric from snapshot deltas inherits the ≥2-sample requirement.
- server/repositories/snapshots.ts:29-41 getFirstSeenDates + library sort=added: a brand-new account has only today's baseline so inferred acquiredAt dates are absent (acquiredAt:null) — same single-period sparsity, surfaced as missing dates rather than empty chart.
- Onboarding-gate omission generalizes: every onboarding-dependent 'my' view reading snapshot/ownedGame tables directly should call getOnboardingStatus() (ERR-0008:238). history/page.tsx is a confirmed gap; verify year-in-review and library pages too.

## Gated checks — human live lane (read-only; never run inside this verification)

### `db`
- ```
  psql "$DATABASE_URL" -c "SELECT \"steamId\", COUNT(*) AS rows, MIN(date) AS first, MAX(date) AS last, (MAX(date)::date - MIN(date)::date) AS span_days FROM \"PlaytimeSnapshot\" GROUP BY \"steamId\" ORDER BY rows DESC LIMIT 20;"
  ```
  **Expect:** For affected (active but empty-history) users, span_days < 7 (week bucket) or rows confined to a single ISO week/month, confirming the single-period collapse rather than an absence of rows. If rows=baseline-count only, the nightly cron has not accrued beyond day 1 (separate config issue).
- ```
  psql "$DATABASE_URL" -c "SELECT id, status, \"startedAt\", \"finishedAt\" FROM \"JobRun\" WHERE name='snapshot' ORDER BY \"startedAt\" DESC LIMIT 10;"
  ```
  **Expect:** If no recent successful snapshot JobRun rows exist, the nightly cron is not accruing snapshots past the onboarding baseline (an unset CRON_SECRET → 401 also pins history at one period). This distinguishes the period-cliff bug from a cron/secret outage.

### `vercel`
- ```
  vercel env ls production | grep -i cron_secret
  ```
  **Expect:** CRON_SECRET present in production. If absent, app/api/cron/snapshot/route.ts returns 401 and no snapshots accrue, independently pinning history at the baseline period.

## Reviewer (adversarial, opus 4.8 · effort xhigh)

**Verdict:** `approve`

**Suite baseline:** pnpm test tests/unit/history-aggregate.test.ts -> Test Files 1 passed (1); Tests 17 passed (17); Duration 776ms (vitest v2.1.9, SQLite test.db, no pending migrations). Green at HEAD as baseline. NOTE: green but the suite ENCODES the bug — tests at :105 and :122 assert that a single period collapses to a length-1 array as correct, which is exactly the period-cliff the page guard then rejects.

**Reasons / findings:**

- Every cited anchor matches HEAD: app/history/page.tsx:64 (points.length < 2 gate), :56 (rows.length === 0), :14 (imports aggregatePlaytime, no getOnboardingStatus); lib/history/aggregate.ts:166 (Sigma max-min) and :183 (zero-fill firstKey..lastKey collapses single period to length 1); server/repositories/snapshots.ts:75 (filter by steamId only); server/onboarding-gate.ts:43; docs/ERROR.md:238/257/259 — all confirmed verbatim.
- Test anchors confirmed verbatim: tests/unit/history-aggregate.test.ts:105 (single month -> [{period:'2026-05',minutes:300}], length 1) and :122 (single ISO week -> length 1). These tests are green at HEAD but ENCODE the bug (they assert the length-1 collapse as correct behavior), which the worker explicitly called out — a correct and important observation.
- Classification 'confirmed-code-bug' is honest and fully explains the symptom: a single snapshot period yields a non-zero one-element series (delta computed correctly at :163-172), but the page guard points.length < 2 short-circuits any one-point series into the 'History is still building' empty state. This is a structural period-cliff, not a data/query/writer problem (getPlaytimeSnapshots returns all rows, refuting missing-data hypotheses).
- Runtime facts are correctly partitioned: all three live items (PlaytimeSnapshot span query, JobRun snapshot query, Vercel CRON_SECRET presence) live in gatedChecks, not evidence. No evidence entry asserts a fact that would have required a live DB/network call.
- Blast radius is complete and verified: lib/insights/year-in-review.ts:149/110 still computes playtime-gained via max-min snapshot delta while achievements were moved to the AchievementUnlock event table (ERR-0009) — the worker's sibling claim is accurate. idle (consecutive-pair deltas), acquiredAt/first-seen sparsity, and the onboarding-gate omission across 'my' views are all correctly flagged. account.ts and cost-per-hour use absolute cumulative playtime (not in-period deltas) and correctly are NOT flagged as sharing the period-cliff.
- The one stale anchor (prisma/schema.prisma:106 vs the @@id at :113) was self-disclosed in staleAnchors with the correct off-by-7 note; verified line 106 is `steamId String` and the composite @@id is at line 113. Honest disclosure, substantively true claim.
- Secondary defect verified: app/history/page.tsx imports neither getOnboardingStatus nor redirect (grep-confirmed sole gate-consumer in app/ is insights/genres), so a signed-in-but-not-onboarded session lands in the 'No history yet' branch instead of redirecting to /onboarding per ERR-0008 — a genuine, distinct empty-history route.
