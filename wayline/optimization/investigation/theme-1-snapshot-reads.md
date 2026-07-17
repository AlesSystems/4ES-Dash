# Optimization Investigation — Theme 1: Unbounded snapshot reads, uncached insights

**Branch:** `altan/optimization` · **HEAD:** `13023e335764daed73900fabc0d88eab4d190eff` · **Date:** 2026-07-09 · **Phase:** investigation

> Read-only root-cause verification of the Theme-1 scout findings against CURRENT source at HEAD.
> Extends prior work in `wayline/evidence/reports/bug-3-insights-slow.md` (root cause #4) and
> `wayline/evidence/verification/bug-3-insights-slow.evidence.md`. Cross-referenced per finding.
>
> **Relationship to bug-3:** bug-3 already root-caused the *dominant conditional* cause (SteamSpy
> per-game fan-out) and named the unbounded snapshot scans + `force-dynamic` + ephemeral-Map cache
> as the flag-independent layer. This theme *decomposes* that layer into per-surface findings, adds
> the **history page** (`getPlaytimeSnapshots`) and **`getAvailableReviewYears`** which bug-3
> mentioned only in passing, verifies the schema-index claim, and measures row counts against the
> dev DB. Nothing here re-litigates the SteamSpy fan-out — that is settled in bug-3.

## Measurement context

- Dev DB `prisma/ci.db`: `PlaytimeSnapshot` has **67 rows**, all for **one steamId**
  (`76561198848120642`) on **one distinct date**. `prisma/test.db`: 0 rows.
- So today the scans are trivially cheap (≤ 67 rows). **Every cost below is a growth projection**:
  the tables are append-only and day-keyed, so row count per user = `owned_games × days_snapshotted`.
  With the 67-game library seed, one year of nightly snapshots ⇒ ≈ `67 × 365 ≈ 24,455` rows/user;
  five years ≈ 122k. That is the number every unbounded `findMany` in this theme pulls into JS per
  render. This is why several verdicts are **needs-measurement**: the code mechanism is confirmed,
  but real-world cost depends on how long snapshotting has been running in the slow environment —
  which I cannot read.

---

## DATA-2 / COMP-2 / RSC-4 — `getIdleFlags` unbounded snapshot scan + JS recompute

**Verdict: confirmed** (mechanism); **needs-measurement** for absolute cost (depends on snapshot history depth).

**Mechanism.** `getIdleFlags` fires `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: {...} })` with **no `date` bound** (idle.ts:33-36). It pulls the user's *entire* playtime history into Node, then `detectIdleSpikes` walks every row in JS to find idle windows. The query is bounded only by `steamId`; the append-only table grows by `owned_games` rows every night, so both the row transfer and the JS pass are `O(full history)` and grow without limit. The `@@index([steamId, date])` (schema.prisma:114) cannot help bound the scan because `date` never appears in the `where` — the planner does an index/table scan of every row for that steamId regardless. Recomputed on every request because the result is not cached (see DATA-4).

**Cost.** Today: 67 rows, sub-millisecond. Projected: `67 games × D days`. At D=365 ⇒ ≈24k rows serialized from SQLite/Postgres → Prisma hydration → JS scan, every idle-page load. Estimate assumes the featured 67-game library and daily snapshots; a multi-user Phase-6 world multiplies this per active user.

**Blast radius.** `/insights/idle` only (single caller: app/insights/idle/page.tsx:35). `force-dynamic` (idle/page.tsx:21) + no cache ⇒ every single nav recomputes; cold start does not help because there is no durable cache to warm. Grows over time.

**Cross-refs.** bug-3 root cause #4 (this is the exact anchor bug-3 cited, idle.ts:33-36 — *covered*, this report confirms it unchanged at HEAD and notes the `Promise.all` wrapper with `idleDismissal` the bug-3 evidence already flagged as drift). Related: DATA-4 (no cache), DATA-7 (index unused). No new ERR-XXXX.

**Evidence.**

| File | Line | Quote |
|------|------|-------|
| server/repositories/insights/idle.ts | 33-36 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: { appId: true, date: true, playtimeForever: true } })` — no date bound |
| server/repositories/insights/idle.ts | 43-46 | `detectIdleSpikes(snapshotRows, thresholdMinutes ?? DEFAULT_IDLE_THRESHOLD_MINUTES)` — full-history JS recompute |
| app/insights/idle/page.tsx | 21 | `export const dynamic = 'force-dynamic';` |

---

## DATA-3 / COMP-1 / RSC-7 — `getYearInReview` reads all playtime + all unlocks to render one year

**Verdict: confirmed** (mechanism); **needs-measurement** for absolute cost.

**Mechanism.** `getYearInReview(steamId, year)` pulls **all** playtime snapshots (`where: { steamId: id }`, year.ts:38-41) *and* **all** achievement-unlock events (`where: { steamId: id }`, :44-47) with **no year/date bound**, then `computeYearInReview` filters to the requested year in JS via per-row `date.getUTCFullYear()` (lib/insights/year-in-review.ts:97) and `unlockedAt.getUTCFullYear()` (:73). The `year` argument is a pure post-filter — the DB is asked for every year the user has ever had. So rendering the 2025 recap still transfers and hydrates 2021–2024 rows only to discard them. Doubly unbounded: playtime *and* unlock tables both scanned in full. `AchievementUnlock` has `@@index([steamId, unlockedAt])` (schema.prisma:143) that a `unlockedAt` range would use, but the query passes only `steamId`.

**Cost.** Playtime side same as DATA-2 (≈24k rows/yr). Unlock side scales with lifetime achievements unlocked. To render *one* year you pay for *all* years — waste factor = `total_years / 1`. A user with 5 years of history does 5× the necessary work on every `/review/[year]` load.

**Blast radius.** `/review/[year]` (app/review/[year]/page.tsx:48-49). `force-dynamic` (review page:31) + no cache. Every year the user clicks re-scans the whole history from scratch; navigating between years N times = N full scans.

**Cross-refs.** bug-3 root cause #4 + blast-radius (`/review/[year]` shares the unbounded scan — *covered*; this report extends it by separating the playtime scan from the *second* unbounded unlock scan, which bug-3 folded together). Related: COMP-8 (the per-row `getUTCFullYear` filter is the symptom), DATA-5 (sibling function on same table), DATA-4 (no cache), DATA-7 (index unused).

**Evidence.**

| File | Line | Quote |
|------|------|-------|
| server/repositories/insights/year-in-review.ts | 38-41 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: { appId, date, playtimeForever } })` — no year bound |
| server/repositories/insights/year-in-review.ts | 44-47 | `prisma.achievementUnlock.findMany({ where: { steamId: id }, ... })` — second unbounded scan |
| lib/insights/year-in-review.ts | 97 | `if (row.date.getUTCFullYear() !== year) continue;` — year discarded in JS |

---

## DATA-6 / COMP-3 / RSC-5 — `getPlaytimeSnapshots` (history page) unbounded scan + full re-bucket

**Verdict: confirmed** (mechanism); **needs-measurement** for absolute cost.

**Mechanism.** `getPlaytimeSnapshots` does `findMany({ where: { steamId: id }, orderBy: { date: 'asc' } })` with **no date bound** (snapshots.ts:75-79). The history page (`app/history/page.tsx:43`) then hands the full row set to the weekly/monthly bucketing in `lib/history/aggregate.ts`, re-bucketing the entire history on every request. Same growth law as DATA-2 — `O(all snapshots)` transfer + `O(all snapshots)` JS aggregate. The `orderBy: { date: 'asc' }` can at least use `@@index([steamId, date])` for ordering, but it still returns *all* rows; the page renders a fixed-width chart that never needs more than the visible window, yet always fetches the lifetime.

**Cost.** ≈`67 × D` rows per load, re-bucketed each time. The stale-anchor claim (snapshots.ts:73) is **accurate** — the function signature is at :73, the query at :75.

**Blast radius.** `/history` (single caller). `force-dynamic` (history/page.tsx:25) + no cache ⇒ every nav re-scans and re-buckets. Grows over time.

**Cross-refs.** **New relative to bug-3** — bug-3's root cause #4 named only `idle` and `year-in-review`; the history page / `getPlaytimeSnapshots` was *not* in bug-3's evidence table. This report adds it as a third instance of the identical unbounded-scan pattern. Related: DATA-4 (no cache — note: `getPlaytimeSnapshots` is *not* one of the four insights repos DATA-4 lists, but shares the no-cache property), DATA-7.

**Evidence.**

| File | Line | Quote |
|------|------|-------|
| server/repositories/snapshots.ts | 75-79 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: {...}, orderBy: { date: 'asc' } })` — no date bound |
| app/history/page.tsx | 43 | `const rows = await getPlaytimeSnapshots(featuredId);` |
| app/history/page.tsx | 25 | `export const dynamic = 'force-dynamic';` |

---

## DATA-4 — none of the four insights repositories wrap work in `cache(...)`

**Verdict: confirmed** (with a precise correction to the claim).

**Mechanism.** The four insights entrypoints — `getGenreBreakdown` (genres.ts:36), `getCostPerHour` (cost-per-hour.ts:33), `getIdleFlags` (idle.ts:26), `getYearInReview`/`getAvailableReviewYears` (year-in-review.ts:16/34) — do **not** wrap their overall computation in `cache(...)`. The only `cache(...)` call in the entire `server/repositories/insights/` tree is the *inner* per-appId SteamSpy lookup inside the genres fan-out loop (genres.ts:96) — that caches individual SteamSpy responses, **not** the aggregate result. So the top-level aggregate (the DB reads + JS recompute) is redone in full on every request for all four surfaces. Compounded by `force-dynamic` on every page and the fact that `server/cache.ts` is a pure in-process `Map` with **no Redis backend** (bug-3 evidence, cache.ts:32) — even if these were wrapped, the cache is lost on every serverless cold start.

**Cost.** Qualitative: 100% recompute rate, 0% hit rate across cold starts. The per-request cost is whatever DATA-2/3/5/6 + the genres/cost-per-hour DB reads sum to.

**Blast radius.** All of `/insights/genres`, `/insights/cost-per-hour`, `/insights/idle`, `/review/[year]`. Every visit, every user. Confidence in the scout table was "med" — this report raises it to **confirmed** by grep: exactly one `cache(` occurrence in the insights tree and it is the SteamSpy inner call.

**Cross-refs.** bug-3 root cause #5 (`force-dynamic` + no shared cache — *covered/extends*: bug-3 framed it as an environment/cache problem; this finding adds that the repos also never *call* cache at the aggregate level, so even adding Redis wouldn't help without a wrap). Related: every other finding in this theme (no-cache is what makes their per-request cost recur).

**Evidence.**

| File | Line | Quote |
|------|------|-------|
| server/repositories/insights/genres.ts | 96 | `const spyResult = await cache(cacheKey('steamspy', 'global', appId), TTL.steamSpy, () => ...)` — only cache call; inner per-appId, not the aggregate |
| server/repositories/insights/cost-per-hour.ts | 33-88 | `getCostPerHour` — two `findMany` + JS rank, no `cache()` wrapper |
| server/repositories/insights/idle.ts | 26-74 | `getIdleFlags` — no `cache()` wrapper |
| server/repositories/insights/year-in-review.ts | 16-61 | both exports — no `cache()` wrapper |

---

## DATA-5 / COMP-4 — `getAvailableReviewYears` loads every snapshot date to derive a few distinct years

**Verdict: confirmed.**

**Mechanism.** `getAvailableReviewYears` does `findMany({ where: { steamId: id }, select: { date: true } })` (year.ts:19-22) — pulls **one Date per snapshot row for the entire history** — then `availableYears` reduces them to a `Set` of distinct `getUTCFullYear()` values (lib/insights/year-in-review.ts:123-128). The output is a handful of integers (one per calendar year, realistically 1–6), but the input is the full row count. This is a textbook "DISTINCT in application code" anti-pattern: the DB could return distinct years (or `groupBy`/`MIN`/`MAX` date) in a bounded result, but instead every row's date is transferred and de-duped in JS. Same `O(all snapshots)` growth as DATA-2.

**Cost.** ≈`67 × D` Date objects transferred to produce ≤ 6 integers. Waste ratio grows unboundedly with history depth. Called on *every* `/review/[year]` render alongside `getYearInReview` (review page:48-49), so the `/review` route pays the full-history scan **twice** (once here, once in DATA-3).

**Blast radius.** `/review/[year]` (both the year-nav and the recap share this). `force-dynamic` + no cache. Every nav.

**Cross-refs.** bug-3 evidence table cited year-in-review.ts:19-22 under root cause #4 (*covered*), but framed it only as "unbounded." This report sharpens it to the specific DISTINCT-in-JS anti-pattern and notes the double-scan of `/review`. Related: DATA-3 (same route, same table), COMP-8, DATA-7.

**Evidence.**

| File | Line | Quote |
|------|------|-------|
| server/repositories/insights/year-in-review.ts | 19-22 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: { date: true } })` — all dates for a few years |
| lib/insights/year-in-review.ts | 123-128 | `for (const row of rows) { years.add(row.date.getUTCFullYear()); }` — DISTINCT computed in JS |

---

## DATA-7 — only index is `@@index([steamId, date])`; hot queries filter on `steamId` alone

**Verdict: confirmed** (mechanism), with nuance.

**Mechanism.** `PlaytimeSnapshot` has PK `@@id([steamId, appId, date])` (schema.prisma:113) and secondary `@@index([steamId, date])` (:114). Every hot query in this theme (DATA-2/3/5/6) filters on `where: { steamId }` only. A leading-column-only predicate on a composite `(steamId, date)` index/PK can seek to the steamId partition but must then scan **every row** in it (all dates, all apps) — there is no bound, so the index reduces to "find this user's rows" and cannot prune. The scout's framing ("index not used") is slightly imprecise: the `(steamId, …)` prefix *is* usable to locate the user's rows, but because no `date`/`appId` bound follows, it still returns the entire per-user partition. The real defect is upstream (unbounded queries, DATA-2/3/5/6), not a missing index — adding a date bound to the queries would immediately let `@@index([steamId, date])` prune. So DATA-7 is a **consequence framing** of the same root cause, not an independent one. `orderBy: { date: 'asc' }` in `getPlaytimeSnapshots` does exploit the index for ordering.

**Cost.** No independent cost — it is the reason DATA-2/3/5/6 are `O(per-user history)` rather than `O(window)`. Would matter most under Postgres in prod with large per-user partitions.

**Blast radius.** All snapshot-reading surfaces. It is a schema-level observation that generalizes across every finding here.

**Cross-refs.** bug-3 root cause #4 evidence row (schema.prisma:114, "index not used to bound the scan" — *covered*; this report refines the mechanism: the index is usable for the prefix but the queries supply no bound to prune with). Root cause is shared with DATA-2/3/5/6.

**Evidence.**

| File | Line | Quote |
|------|------|-------|
| prisma/schema.prisma | 113 | `@@id([steamId, appId, date])` |
| prisma/schema.prisma | 114 | `@@index([steamId, date])` — only secondary index; hot queries pass steamId only |

---

## COMP-8 — per-row `getUTCFullYear()` over full history to discard non-year rows

**Verdict: confirmed** (symptom, low severity).

**Mechanism.** In `computeYearInReview`, `deltasByApp` walks every playtime row and does `if (row.date.getUTCFullYear() !== year) continue;` (lib/insights/year-in-review.ts:97), and `countUnlocksInYear` does the same on `unlockedAt` (:73). Because the repository (DATA-3) hands over *all* years, this pure code must touch and date-parse every historical row just to keep the requested year's subset. It is the **JS-side symptom** of DATA-3/COMP-1's unbounded query, not an independent inefficiency: if the DB filtered by year, this loop would only see the relevant rows. `getUTCFullYear()` per row is cheap individually; the waste is doing it `O(all history)` times to keep `O(one year)` rows.

**Cost.** Negligible per row; total = one date-parse per historical snapshot per `/review` render. Dominated by the transfer cost in DATA-3.

**Blast radius.** `/review/[year]` only (lib function reached via getYearInReview). Symptom disappears if DATA-3 is bounded.

**Cross-refs.** Direct child of DATA-3/COMP-1. Not separately in bug-3 (*new*, but purely a restatement of #4's JS-recompute half). Lowest priority.

**Evidence.**

| File | Line | Quote |
|------|------|-------|
| lib/insights/year-in-review.ts | 97 | `if (row.date.getUTCFullYear() !== year) continue;` |
| lib/insights/year-in-review.ts | 73 | `const y = row.unlockedAt.getUTCFullYear();` |

---

## Theme-level ranking — which findings dominate

Ranked by growth-weighted blast radius (all share the same append-only growth law; ranking is by
per-request multiplier × route frequency):

1. **DATA-3 / COMP-1 (`getYearInReview`)** — *doubly* unbounded (playtime **and** unlocks), and the
   `/review` route pays a full-history scan **twice** when combined with DATA-5. Highest waste ratio
   (`all_years / 1`).
2. **DATA-2 (`getIdleFlags`)** and **DATA-6 (`getPlaytimeSnapshots`)** — single unbounded scan +
   full JS recompute each, one route apiece. DATA-6 is the finding bug-3 did **not** cover.
3. **DATA-5 (`getAvailableReviewYears`)** — full scan to produce ≤6 integers; compounds DATA-3 on the
   same route.
4. **DATA-4 (no `cache()` wrap)** — the *multiplier* that turns every scan above into a per-visit
   recompute; fixing it (or `force-dynamic`→ISR) blunts all of them even before the queries are bounded.
5. **DATA-7 (index/query mismatch)** — not independent; it is the schema-side explanation for why
   1–3 are `O(history)`. Bounding the queries makes the existing index effective.
6. **COMP-8** — pure JS symptom of DATA-3; vanishes once DATA-3 is bounded. Lowest.

**Two structural fixes collapse most of the theme** (fix directions, one line each, not implemented):
add a `date`/`year`/`unlockedAt` bound (or nightly precompute) to the DATA-2/3/5/6 queries so
`@@index([steamId, date])` prunes; and wrap the four aggregates in `cache(...)` and/or relax
`force-dynamic` to `revalidate` so read-mostly aggregates survive across visits.

## Open questions (needs-measurement)

- **How deep is the snapshot history in the slow environment?** Dev DB has 67 rows on 1 day, so
  scans are free *today*. The verdicts are "confirmed mechanism"; absolute cost is unknown until
  `SELECT steamId, COUNT(*) FROM PlaytimeSnapshot GROUP BY steamId` is run against prod/staging.
  Closes DATA-2/3/5/6 cost columns. (Same `db-rowcount` gated check bug-3 already queued.)
- **Is there any durable cache in prod?** bug-3 established `server/cache.ts` is an in-process `Map`
  and `REDIS_URL` is read nowhere — confirmed here by inheritance. If prod remains single-instance
  Map-only, DATA-4's 0% cross-start hit rate holds.
- **Multi-user amplification (Phase 6):** every per-request full-history scan is currently one user;
  under multi-user auth the cost multiplies per active user with no shared-cache relief.
