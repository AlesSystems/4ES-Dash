# Evidence — Theme 1: Unbounded snapshot reads, uncached insights (adversarial verification)

> Read-only adversarial verification of the Theme-1 scout report
> (`wayline/optimization/investigation/theme-1-snapshot-reads.md`).
> Branch `altan/optimization` · HEAD `13023e335764daed73900fabc0d88eab4d190eff` · Date 2026-07-09
>
> **Reviewer:** adversarial optimization reviewer (separate context from scout).
> **Cross-checked against:** `wayline/evidence/verification/bug-3-insights-slow.evidence.md` (already-adjudicated overlapping ground) and the dev DB `prisma/ci.db`.

## Verdict summary

| Finding ID | Scout verdict | Reviewer verdict | One-line |
|---|---|---|---|
| DATA-2 / COMP-2 / RSC-4 (`getIdleFlags`) | confirmed mech / needs-measurement | **PLAUSIBLE** | Mechanism (unbounded steamId-only scan + JS recompute) fully reproduced; absolute magnitude gated on `db-rowcount`. |
| DATA-3 / COMP-1 / RSC-7 (`getYearInReview`) | confirmed mech / needs-measurement | **PLAUSIBLE** | Doubly unbounded (playtime **and** unlocks) confirmed in code; magnitude gated on `db-rowcount`. |
| DATA-6 / COMP-3 / RSC-5 (`getPlaytimeSnapshots`) | confirmed mech / needs-measurement | **PLAUSIBLE** | Unbounded scan + full re-bucket confirmed; new instance not in bug-3; magnitude gated. |
| DATA-4 (no `cache()` wrap) | confirmed | **CONFIRMED** | Pure code fact: exactly one `cache(` in the insights tree, and it is the inner per-appId SteamSpy call. |
| DATA-5 / COMP-4 (`getAvailableReviewYears`) | confirmed | **CONFIRMED** | DISTINCT-in-application anti-pattern confirmed; `/review` scans PlaytimeSnapshot twice per load. |
| DATA-7 (index/query mismatch) | confirmed | **CONFIRMED** | Schema fact; scout's own "consequence-framing, not independent" nuance accepted. |
| COMP-8 (per-row `getUTCFullYear`) | confirmed | **CONFIRMED** | JS-side symptom of DATA-3; disappears if DATA-3 is bounded. |

**No claim REFUTED. No stale anchors of consequence** (one trivial ±1 end-line drift, below). The scout's line numbers are unusually accurate — every anchor re-opened this run matches HEAD.

The three PLAUSIBLE verdicts are downgrades **only** on absolute magnitude, mirroring how bug-3 quarantined every rowcount/latency claim to gated checks. The *code mechanism* (no date bound → O(per-user history) transfer + JS pass, growing without limit) is CONFIRMED for all three. Today the scans are trivially cheap — the dev DB holds 67 rows on one date (verified below), sub-millisecond — so the scout's 24k-rows/yr figure is an explicit growth **projection**, not a measured cost, and cannot be settled without reading prod/staging snapshot depth.

---

## DATA-2 / COMP-2 / RSC-4 — `getIdleFlags` unbounded scan + JS recompute — **PLAUSIBLE**

Mechanism reproduced from source. `getIdleFlags` issues `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: {...} })` with **no `date` predicate**, then hands the full row set to `detectIdleSpikes`, which walks every row in JS. The `@@index([steamId, date])` cannot prune because `date` never appears in `where`. Result not cached (see DATA-4); page is `force-dynamic`. Single caller. All exactly as the scout states.

Downgraded to PLAUSIBLE only because the scout's headline cost (≈24k rows/load at 1yr) is a projection: the dev DB is 67 rows on 1 date, so the scan is free *today*. The unboundedness/complexity claim is CONFIRMED; the absolute prod cost is the gated part.

| File | Line | Finding (opened this run) |
|---|---|---|
| server/repositories/insights/idle.ts | 32-41 | `Promise.all([ prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: { appId, date, playtimeForever } }), prisma.idleDismissal.findMany(...) ])` — playtime scan has **no date bound**. |
| server/repositories/insights/idle.ts | 43-46 | `detectIdleSpikes(snapshotRows, thresholdMinutes ?? DEFAULT_IDLE_THRESHOLD_MINUTES)` — full-history JS recompute over the scanned rows. |
| app/insights/idle/page.tsx | 21 | `export const dynamic = 'force-dynamic';` |
| app/insights/idle/page.tsx | 35 | `const flags = await getIdleFlags(viewerId);` — sole caller. |

**Fix direction:** add a `date >= cutoff` bound (or precompute idle flags nightly) so `@@index([steamId, date])` prunes.

---

## DATA-3 / COMP-1 / RSC-7 — `getYearInReview` reads all playtime + all unlocks to render one year — **PLAUSIBLE**

Mechanism reproduced. `getYearInReview(steamId, year)` runs two unbounded `findMany`s in `Promise.all`: playtime (`where: { steamId: id }`, no year bound) and `achievementUnlock` (`where: { steamId: id }`, no `unlockedAt` bound). `year` is a pure post-filter applied in JS (`computeYearInReview` → `deltasByApp`/`countUnlocksInYear` filter by `getUTCFullYear()`). `AchievementUnlock` has `@@index([steamId, unlockedAt])` (schema:143) that an `unlockedAt` range would use, but the query passes only `steamId`. Doubly unbounded — confirmed.

Downgraded to PLAUSIBLE on magnitude (same `db-rowcount` gate). Complexity claim confirmed.

**Scout omission (does not change verdict):** the scout's evidence table lists only the two unbounded scans. `getYearInReview` also runs a **third** query — `prisma.game.findMany({ where: { appId: { in: appIds } } })` (year-in-review.ts:53-56) — whose `appIds` are derived from **all** `playtimeRows` (every year), not just the rendered year (line 51). This inflates the name lookup to every app ever snapshotted. It is bounded by distinct owned games (~67), i.e. `O(games)` not `O(history)`, so it is a minor extra cost, not a new unbounded scan — but the scout should have noted it.

| File | Line | Finding (opened this run) |
|---|---|---|
| server/repositories/insights/year-in-review.ts | 38-41 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: { appId, date, playtimeForever } })` — no year/date bound. |
| server/repositories/insights/year-in-review.ts | 44-47 | `prisma.achievementUnlock.findMany({ where: { steamId: id }, select: {...} })` — second unbounded scan. |
| server/repositories/insights/year-in-review.ts | 51-56 | `appIds = Set(playtimeRows.map(...))` then `game.findMany({ where: { appId: { in: appIds } } })` — names for **all** years' apps (scout-omitted third query). |
| lib/insights/year-in-review.ts | 97 | `if (row.date.getUTCFullYear() !== year) continue;` — year discarded in JS. |
| app/review/[year]/page.tsx | 31 | `export const dynamic = 'force-dynamic';` |
| app/review/[year]/page.tsx | 47-49 | `Promise.all([ getAvailableReviewYears(featuredId), getYearInReview(featuredId, year) ])` — sole caller. |

**Fix direction:** bound both scans by the requested year's `date` / `unlockedAt` range so the two existing indexes prune.

---

## DATA-6 / COMP-3 / RSC-5 — `getPlaytimeSnapshots` (history page) unbounded scan + full re-bucket — **PLAUSIBLE**

Mechanism reproduced. `getPlaytimeSnapshots` does `findMany({ where: { steamId: id }, select: {...}, orderBy: { date: 'asc' } })` with **no date bound**; the history page hands the full row set to `aggregatePlaytime` for weekly/monthly bucketing on every request. `orderBy: { date: 'asc' }` can use `@@index([steamId, date])` for ordering but still returns every row. Genuinely a **new** instance relative to bug-3 — confirmed by grep that bug-3's evidence table (idle + year-in-review only) never cites `snapshots.ts` or the history page.

Downgraded to PLAUSIBLE on magnitude (`db-rowcount` gate). Complexity claim confirmed. The scout's note that the "stale anchor" snapshots.ts:73 is *accurate* (signature at :73, query at :75) checks out.

| File | Line | Finding (opened this run) |
|---|---|---|
| server/repositories/snapshots.ts | 73 | `export async function getPlaytimeSnapshots(steamId: string)` — signature (scout's :73 anchor correct). |
| server/repositories/snapshots.ts | 75-79 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: {...}, orderBy: { date: 'asc' } })` — no date bound. |
| app/history/page.tsx | 43 | `const rows = await getPlaytimeSnapshots(featuredId);` then `aggregatePlaytime(rows, bucket)` (:44). |
| app/history/page.tsx | 25 | `export const dynamic = 'force-dynamic';` |

**Fix direction:** bound the query to the visible chart window (or paginate) so only the rendered range is transferred and bucketed.

---

## DATA-4 — none of the four insights repositories wrap work in `cache(...)` — **CONFIRMED**

Pure code fact, independently reproduced. `rg 'cache\(' server/repositories/insights/` returns **exactly one** hit: genres.ts:96, the *inner* per-appId SteamSpy lookup — not the aggregate. `getGenreBreakdown`, `getCostPerHour`, `getIdleFlags`, `getYearInReview`/`getAvailableReviewYears` never wrap their top-level computation in `cache(...)`. Compounded by `force-dynamic` on every page and the fact that `server/cache.ts` is a pure in-process `Map` (cache.ts:32, comment at :4-5 "no Redis dependency"); `REDIS_URL` is declared at env.ts:27 and read nowhere else — inherited from bug-3 and re-confirmed by grep this run.

**Missed-mitigation check (came up clean for the scout):** `server/cache.ts:36` holds an `inFlight = new Map(...)` single-flight dedupe. It does **not** rescue these findings — it only dedupes concurrent callers of the *same* `cache()` key, and the aggregates never call `cache()` at all. There is also no React `cache()`/`fetch` memoization on the repos (`rg "from 'react'"` in the repo files: none). So no mitigating mechanism was overlooked.

| File | Line | Finding (opened this run) |
|---|---|---|
| server/repositories/insights/genres.ts | 96 | `await cache(cacheKey('steamspy', 'global', appId), TTL.steamSpy, () => getSteamSpyData(appId))` — only `cache(` in the tree; inner per-appId, not the aggregate. |
| server/repositories/insights/cost-per-hour.ts | 33-88 | `getCostPerHour` — two `findMany` + `rankCostPerHour`, no `cache()` wrapper. |
| server/repositories/insights/idle.ts | 26-74 | `getIdleFlags` — no `cache()` wrapper. |
| server/repositories/insights/year-in-review.ts | 16-61 | both exports — no `cache()` wrapper. |
| server/cache.ts | 32 | `const store = new Map<string, Entry<unknown>>();` — ephemeral in-process store. |

**Fix direction:** wrap each aggregate in `cache(cacheKey(...), TTL, loader)` and/or relax `force-dynamic` to `revalidate` for read-mostly aggregates.

---

## DATA-5 / COMP-4 — `getAvailableReviewYears` loads every snapshot date to derive a few years — **CONFIRMED**

Reproduced. `getAvailableReviewYears` does `findMany({ where: { steamId: id }, select: { date: true } })` — one `Date` per snapshot row for the entire history — then `availableYears` reduces to a `Set<number>` of distinct `getUTCFullYear()` (≤ ~6 integers). Textbook DISTINCT-in-application anti-pattern: a `groupBy`/`SELECT DISTINCT` would return the bounded result server-side. This is a code-structural fact independent of magnitude, so CONFIRMED (not downgraded); the row-transfer *volume* still grows with history depth, but the anti-pattern itself is verified.

The scout's **double-scan** claim on `/review` is correct: `getAvailableReviewYears` (select `date`) and `getYearInReview` (select `appId,date,playtimeForever`) are two separate `findMany`s on `PlaytimeSnapshot`, both `steamId`-only, run in parallel via `Promise.all` (review page:47-49) — so `/review/[year]` scans the table's full per-user partition twice per load.

| File | Line | Finding (opened this run) |
|---|---|---|
| server/repositories/insights/year-in-review.ts | 19-22 | `prisma.playtimeSnapshot.findMany({ where: { steamId: id }, select: { date: true } })` — all dates for ≤6 years. |
| lib/insights/year-in-review.ts | 123-129 | `availableYears`: `for (const row of rows) { years.add(row.date.getUTCFullYear()); }` — DISTINCT computed in JS. |

**Fix direction:** replace with `groupBy(['date'])` truncated to year, or `MIN/MAX(date)` — return distinct years from the DB.

---

## DATA-7 — only index is `@@index([steamId, date])`; hot queries filter on `steamId` alone — **CONFIRMED**

Schema fact reproduced. `PlaytimeSnapshot` has PK `@@id([steamId, appId, date])` (schema:113) and secondary `@@index([steamId, date])` (schema:114). Every hot query in this theme filters `where: { steamId }` only, so the `(steamId, …)` prefix seeks to the user's partition but cannot prune within it — the scan returns the whole partition. I accept the scout's own honesty here: DATA-7 is a **consequence-framing** of DATA-2/3/5/6, not an independent defect; adding a `date` bound to those queries makes the existing index effective. Confirmed as stated, including the caveat.

| File | Line | Finding (opened this run) |
|---|---|---|
| prisma/schema.prisma | 113 | `@@id([steamId, appId, date])` |
| prisma/schema.prisma | 114 | `@@index([steamId, date])` — only secondary index; hot queries pass `steamId` only. |
| prisma/schema.prisma | 143 | `@@index([steamId, unlockedAt])` on `AchievementUnlock` — likewise unused by the DATA-3 unlock scan (no `unlockedAt` bound). |

**Fix direction:** not a schema change — bound the queries (DATA-2/3/5/6); the indexes already exist.

---

## COMP-8 — per-row `getUTCFullYear()` over full history to discard non-year rows — **CONFIRMED**

Reproduced. `deltasByApp` does `if (row.date.getUTCFullYear() !== year) continue;` (lib:97) over every playtime row; `countUnlocksInYear` does `const y = row.unlockedAt.getUTCFullYear();` (lib:73) over every unlock row. Because DATA-3 hands over all years, this pure code date-parses every historical row to keep one year's subset. It is the JS-side **symptom** of DATA-3's unbounded query, not independent — vanishes once DATA-3 is bounded. Confirmed as low-severity, exactly as the scout ranks it.

| File | Line | Finding (opened this run) |
|---|---|---|
| lib/insights/year-in-review.ts | 97 | `if (row.date.getUTCFullYear() !== year) continue;` |
| lib/insights/year-in-review.ts | 73 | `const y = row.unlockedAt.getUTCFullYear();` |

**Fix direction:** none independent — bounding DATA-3 removes the wasted per-row parses.

---

## Stale anchors (claimed vs actual at HEAD)

| File | Claimed | Actual | Note |
|---|---|---|---|
| lib/insights/year-in-review.ts | 123-128 (`availableYears` reduce) | function spans 123-129; `years.add(...)` at 126 | Trivial ±1 end-line drift; cited content (the `.add` loop) is inside the range. Not materially stale. |
| server/repositories/insights/idle.ts | 33-36 (bare `findMany`) | 33-36, wrapped in `Promise.all([...])` at 32-41 | Same drift bug-3 already recorded: the scan is inside a `Promise.all` alongside `idleDismissal.findMany`, not a standalone call. Scout's own report notes this. Content unchanged. |

Every other anchor in the scout report (idle.ts:33-36/43-46, year-in-review.ts:19-22/38-41/44-47, lib:73/97, snapshots.ts:73/75-79, genres.ts:96, cost-per-hour.ts:33-88, history/page.tsx:25/43, review/[year]/page.tsx:31/47-49, idle/page.tsx:21/35, schema.prisma:113/114/143) matches HEAD exactly.

---

## Blast-radius corrections

- **All three unbounded surfaces are single-caller**, as the scout states — confirmed by grep: `getIdleFlags` → app/insights/idle/page.tsx:35 only; `getYearInReview`/`getAvailableReviewYears` → app/review/[year]/page.tsx:47-49 only; `getPlaytimeSnapshots` → app/history/page.tsx:43 only. No over-statement.
- **No in-page `<Suspense>`** on `/insights/idle`, `/history`, or `/review/[year]` — only route-level `loading.tsx` skeletons exist (`app/*/loading.tsx`). So each page blocks on its slowest await; the skeleton does not reduce work. Matches bug-3's finding; the scout did not overstate available streaming mitigation.
- **DATA-6 blast radius is genuinely additive to bug-3** — bug-3's evidence table covers only `idle` and `year-in-review`; `snapshots.ts`/`getPlaytimeSnapshots`/`/history` are absent from it. The scout's "new relative to bug-3" claim is correct.

---

## Gated checks — human live lane (read-only; never run inside this verification)

These settle the three PLAUSIBLE verdicts (DATA-2, DATA-3, DATA-6). Identical to bug-3's queued `db-rowcount`/`timing` gates — the magnitude question is shared ground.

### `db-rowcount`
```
SELECT steamId, COUNT(*) AS rows FROM "PlaytimeSnapshot" GROUP BY steamId ORDER BY rows DESC LIMIT 5;
SELECT steamId, COUNT(*) AS rows FROM "AchievementUnlock" GROUP BY steamId ORDER BY rows DESC LIMIT 5;
```
**Expect:** reveals how many rows each unbounded `findMany` pulls per render in the slow environment. Dev DB `prisma/ci.db` was measured this run at **67 rows / 1 steamId / 1 distinct date** (`prisma/test.db` = 0), so the scans are sub-ms *today*. Large/growing prod counts would promote DATA-2/3/6 from PLAUSIBLE to a measured material cost. Settles the playtime side of all three and the unlock side of DATA-3.

### `timing`
```
console.time / performance.now() around getIdleFlags, getYearInReview+getAvailableReviewYears, and getPlaytimeSnapshots on a real authenticated render (or read the Vercel function-duration trace for /insights/idle, /review/[year], /history).
```
**Expect:** duration scales with the user's snapshot/unlock row count if the O(history) scan dominates. Compare against ERR-0011's recorded figures. Confirms whether the projected growth is the actual bottleneck vs. the (default-OFF, per bug-3) SteamSpy fan-out.

### `prod-cache-durability` (inherited from bug-3, settles DATA-4's hit-rate magnitude)
```
Confirm whether prod runs single-instance with the in-process Map (server/cache.ts:32) or has any shared/durable cache. REDIS_URL (env.ts:27) is read nowhere in source (verified by grep this run).
```
**Expect:** if prod stays Map-only, DATA-4's ~0% cross-cold-start hit rate holds and every scan recomputes per cold start. (DATA-4's *code* claim — no aggregate `cache()` wrap — is already CONFIRMED regardless of this gate.)
