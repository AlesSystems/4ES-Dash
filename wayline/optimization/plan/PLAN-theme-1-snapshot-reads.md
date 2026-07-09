# PLAN — Theme 1: Unbounded snapshot reads, uncached insights

**Theme:** 1 — Unbounded snapshot reads, uncached insights
**Branch:** `altan/optimization` · **Investigation HEAD:** `13023e3` · **Date:** 2026-07-09
**Status: REVISED (round 2) — re-baselined against the post-merge state of `fix/bug-1-history-period-cliff` → `fix/bug-2-yir-baseline` → `fix/bug-3-insights-perf` per `wayline/evidence/IMPLEMENTATION.md` §2; round 2 restores the full `{gte,lt}` bound on the main YiR playtime scan (the round-1 `lt`-only reconciliation left the current-year scan unbounded below — DATA-3 survived).**

Inputs: `wayline/optimization/investigation/theme-1-snapshot-reads.md` (scout),
`wayline/optimization/verification/theme-1-snapshot-reads.evidence.md` (receipt — authoritative),
`wayline/optimization/investigation/SUMMARY.md` (adjudication + dependencies),
bug-3 receipts (`wayline/evidence/reports/bug-3-insights-slow.md`, `wayline/evidence/verification/bug-3-insights-slow.evidence.md`),
`wayline/evidence/IMPLEMENTATION.md` §2 (bug-1→2→3 merge order — Theme 1's baseline).
All source anchors below re-verified at HEAD **and on the three fix branches** during planning.

## Sequencing (binding)

**Theme 1 lands strictly AFTER the bug-1 → bug-2 → bug-3 merge** (IMPLEMENTATION.md §2). Three of the five original mechanisms are partially or fully shipped on those branches:

- `fix/bug-3-insights-perf` already bounds `getIdleFlags` (`date: { gte: since }`, `since = now − IDLE_LOOKBACK_DAYS·86400000`, idle.ts) **and** already exports `IDLE_LOOKBACK_DAYS` from `lib/insights`. Theme 1 does **not** re-implement either (see T3).
- `fix/bug-3-insights-perf` already adds a `gte/lt` UTC-year bound to `getYearInReview`'s playtime scan (year-in-review.ts:38-41) — but `fix/bug-2-yir-baseline` changes the semantics at the same lines: it derives a per-app **pre-year baseline** ("last snapshot strictly before Jan 1", ERR-0019) from the fetched rows and passes it as a 5th `baselineByApp` argument to `computeYearInReview`; the year's gain is **(in-year max) − pre-year baseline**, NOT within-year max−min. A hard `gte: Jan 1(year)` lower bound strips every pre-year row, empties `baselineByApp`, and regresses bug-2. IMPLEMENTATION.md §2's "take-both" merge instruction therefore leaves a latent conflict that **T1 exists to reconcile** — that is T1's residual scope (see T1).
- `fix/bug-1-history-period-cliff` rewrites both files T4 touches: `app/history/page.tsx` gains a `getOnboardingStatus()` redirect gate before the fetch, and `lib/history/aggregate.ts` gains an `aggregateByDay` day-granularity fallback so short spans still draw. T4 is planned against that post-merge state (see T4).

Every task below is specified against the merged tree, not against `13023e3`.

---

## Root causes addressed

| Finding ID | Reviewer verdict | Receipt justification | Post-merge residual | Gated check |
|---|---|---|---|---|
| DATA-4 | CONFIRMED | Pure code fact: exactly one `cache(` in `server/repositories/insights/` and it is the inner per-appId SteamSpy lookup (genres.ts:96) — no aggregate is ever cached; 100% recompute per visit. | **Fully open** — bug-3 bounds scans but caches no aggregate. | `prod-cache-durability` (magnitude only — code claim already settled) |
| DATA-5 / COMP-4 | CONFIRMED | DISTINCT-in-application: `getAvailableReviewYears` transfers one `Date` per lifetime snapshot row to derive ≤~6 integers; `/review/[year]` scans the per-user partition twice per load (with DATA-3, via `Promise.all`). | **Fully open** — untouched by bug-1/2/3. | — (code-structural, not gated) |
| DATA-2 / COMP-2 / RSC-4 | PLAUSIBLE | `getIdleFlags` scanned `PlaytimeSnapshot` with `where: { steamId }` only; `detectIdleSpikes` walks every row in JS. | **Largely closed by bug-3** (shipped `gte: since` bound + `IDLE_LOOKBACK_DAYS`). Residual: aggregate uncached (T5); optional +1-day predecessor-pair margin routed to bug-3's lane, not this theme (T3). | `db-rowcount` |
| DATA-3 / COMP-1 / RSC-7 | PLAUSIBLE | `getYearInReview` scanned all playtime **and** all achievement unlocks; receipt added a third `O(games)` query (`game.findMany` over appIds from all years' rows). | **Partially closed by bug-3** (playtime bound — but see the bug-2 baseline conflict above). Residual: reconcile the bound with bug-2's baseline; the **unlock scan is still unbounded** on every branch; `game.findMany` shrinks once playtime rows shrink. | `db-rowcount` |
| DATA-6 / COMP-3 / RSC-5 | PLAUSIBLE | `getPlaytimeSnapshots` (snapshots.ts) unbounded scan + full re-bucket on every `/history` request. Genuinely new vs bug-3 (bug-3 never cites `snapshots.ts`). | **Fully open** — bug-1 changed the page's gating/fallback, not the fetch bound. | `db-rowcount` |

### Folded / excluded

| Finding ID | Disposition | Reason (one line) |
|---|---|---|
| DATA-7 | **Folded into T1–T4 (bounding)** | Reframed by the receipt: the `@@index([steamId, date])` (schema.prisma:114) and `@@index([steamId, unlockedAt])` (:143) already EXIST; the defect is upstream — queries pass no `date`/`unlockedAt` bound. Bounding makes both indexes prune. **NO new index, NO migration.** |
| COMP-8 | **Dissolves with T1** | Per-row `getUTCFullYear()` over full history is the JS-side symptom of DATA-3; once the DB returns only baseline + in-year rows the wasted parses shrink accordingly. No task, no lib change required. |

Out-of-lane dependencies stated, not decided here: durable cache backend (bug-3's lane), `force-dynamic` → `revalidate` relaxation (bug-3 root cause #5 / Theme 3), shell blocking RSC-1/2 (Theme 3, sequences first — see Measurement plan), limiter partitioning (Theme 2 / Phase 6), idle predecessor-pair margin (bug-3's lane, see T3).

---

## Chosen fix

**Bound every snapshot-reading query to the window the surface actually needs — reconciling, never duplicating, the bounds bug-3 already shipped — then cache each aggregate result.** These are complements per the binding design rule: caching without bounding hides the full-partition scans until every serverless cold start (the cache is an in-process Map, `server/cache.ts:32` — it starts empty); bounding without caching still recomputes the aggregate on every request under `force-dynamic`. Doing both removes the root cause at both layers: the DB stops transferring `O(per-user lifetime history)` rows (the *existing* composite indexes prune — this is how DATA-7 dissolves), and the JS aggregate stops running per request (DATA-4).

Mechanism per surface:

1. **`getYearInReview` (DATA-3) — post-merge reconciliation, not a new bound.** Bug-3 owns the playtime `gte/lt` year bound (verified on `fix/bug-3-insights-perf` year-in-review.ts: `date: { gte: yearStart, lt: yearEnd }`); bug-2 owns the pre-year `baselineByApp` semantics (year gain = in-year max − last pre-Jan-1 snapshot per app). On the naïve merged tree the hard `gte` starves the baseline, so T1 reconciles by **decoupling the baseline's data source from the main scan** — NOT by loosening the main scan's bound: **keep bug-3's full `{ gte: Date.UTC(year,0,1), lt: Date.UTC(year+1,0,1) }` bound on the main playtime scan unchanged**, and replace bug-2's implicit "derive baseline from the main fetch's pre-year rows" with an **explicit, separately bounded baseline fetch** — a `groupBy(['appId'], where: { steamId, date: { lt: yearStart } }, _max: { date })` followed by a keyed fetch of those rows (or an equivalent two-step indexed read), so `baselineByApp` is byte-identical to bug-2's full-history derivation. Once the baseline is sourced from its own bounded query, the `gte` starves nothing — dropping it (the round-1 mistake) would leave the current-year scan (`lt: Jan 1(year+1)` matches every row for the review year in progress) exactly as unbounded as the original DATA-3 defect, and T5 would then cache an unbounded scan, violating the binding bound+cache complement rule. Both queries prune on `@@index([steamId, date])`; the main scan transfers `games×days_year` rows and the baseline fetch at most one row per app. Additionally bound the **unlock scan** (`unlockedAt: { gte: yearStart, lt: yearEnd }`) — unclaimed by any bug branch; `@@index([steamId, unlockedAt])` prunes. The receipt's third query fixes itself: `appIds` derives from the (now baseline+year-bounded) `playtimeRows`, so `game.findMany` shrinks with zero extra code. The JS year filter inside `computeYearInReview` stays as the defensive pure-module contract.
2. **`getAvailableReviewYears` (DATA-5):** replace the full-row fetch with `findMany({ where: { steamId }, distinct: ['date'], select: { date: true } })` — Prisma-native, no raw SQL, portable SQLite/Postgres. **Caveat (binding on the measurement claims):** on some connectors — notably SQLite in dev/CI — Prisma applies `distinct` in the query engine rather than as SQL `DISTINCT`, so the DB→engine row transfer may not shrink there; the guaranteed SQLite win is reduced Prisma hydration/serialization (rows materialized to JS drop from `games × days` to `days`), while the full transfer-level win is expected on Postgres in prod. `availableYears()` in lib is unchanged (it already reduces `{date}[]` → distinct years). This keeps year derivation exact (no phantom years from a MIN/MAX-range approach when a calendar year has zero snapshots).
3. **`getIdleFlags` (DATA-2): adopt bug-3's shipped bound — no re-implementation.** The `date: { gte: since }` bound and the exported `IDLE_LOOKBACK_DAYS` constant already exist on `fix/bug-3-insights-perf` and arrive via the merge. Theme 1 makes **zero changes** to the idle query or to `lib/insights/idle.ts`. The previously proposed +1-day predecessor-pair margin (so the first in-window snapshot still has a pair) is a potential correctness refinement to *bug-3's* bound — creating a second, divergent bound here would be the two-fixes-for-one-tail anti-pattern — so it is **routed to bug-3's lane** as a proposed amendment (see T3), not implemented in this theme. Dismissal semantics are bug-3's shipped behavior and are untouched.
4. **`getPlaytimeSnapshots` (DATA-6):** bound to the chart's rendered window via an optional `{ since?: Date }` argument (default: unbounded, so `getFirstSeenDates` siblings and any future caller are untouched); `/history` (post-bug-1 page, i.e. **after** the `getOnboardingStatus()` redirect gate) passes a per-bucket lookback (proposed `week` → 53 weeks, `month` → 25 months, constants in `lib/history/aggregate.ts`). **Window-edge correctness:** `aggregatePlaytime` bucket totals are intra-bucket `Σ(max−min)` and self-contained — there is no cross-bucket baseline pair — so the real edge requirement is that `since` is **floored to the bucket boundary** (ISO week start / month start, matching `aggregatePlaytime`'s bucketing) so the oldest rendered bucket receives all of its rows; a mid-bucket `since` would under-count the first bar. The `since` helper computes lookback then floors. `aggregatePlaytime` and bug-1's `aggregateByDay` fallback are unchanged. **Pre-window-only data (new bug-1-class case):** an ONBOARDED user whose snapshots all predate the window must NOT see "No history yet" (that copy means "no snapshots exist"). When the windowed fetch returns zero rows, the page does a cheap existence check (`findFirst` with `select: { appId: true }` — the table has a compound PK and no scalar `id` — or `count`, on `{ steamId }`, indexed, one row) and renders the "History is still building" designed state (or window-accurate copy reviewed in-task, e.g. "No playtime in the last N weeks") instead of the no-data state. Degrade-never-fabricate holds throughout.
5. **Aggregate caching (DATA-4):** wrap the top-level result of each insights aggregate — `getIdleFlags` (snapshot→`detectIdleSpikes` stage only; the `idleDismissal` fetch and filter run **outside** the cache so a dismissal takes effect on the very next request), `getYearInReview` (key includes year), `getAvailableReviewYears`, `getCostPerHour`, `getGenreBreakdown`, and the `/history` aggregate — in `cache(cacheKey(...), TTL.insightsAggregate, loader)`. **Because the cached idle stage runs `detectIdleSpikes(rows, thresholdMinutes)` and its output depends on the threshold, the idle cache key includes the effective threshold** (`insights-idle:<steamId>:<thresholdMinutes>`, with the default applied before keying so explicit-default and omitted calls share an entry). One new TTL entry in `server/cache/ttl.ts` (proposed `insightsAggregate: 21600 // 6 h — snapshot tables written once nightly`); keys use the existing `cacheKey(endpoint, steamId[, discriminator])` helper, discriminators documented at the call sites. Stale-while-revalidate and single-flight come free from `server/cache.ts`. This plan **depends on** bug-3's durable-cache lane for cross-cold-start hit rate; the wrap is backend-agnostic by design ("swapping it in production is a one-file change", cache.ts:4-6). **Merge coordination:** Theme 2 adds `achievementSchema`/`achievementGlobal` to the same frozen `TTL` map — keys are disjoint (no logical conflict); resolve the shared-file textual conflict take-both.

Past years get a bonus: a completed year's `getYearInReview` result is immutable, but this plan deliberately uses one uniform TTL (no special-casing closed years) to keep TTL policy in one place; a longer closed-year TTL is a follow-up once a durable cache exists.

### Rejected alternatives

- **Nightly precompute of aggregates into new tables (materialized insights).** Rejected for this theme: it requires new Prisma models + migrations (Theme 1's receipt explicitly needs none), duplicates the snapshot job's write path, adds staleness/idempotency surface to the cron lane (Theme 5's congested territory), and the win it buys over bound+cache only materializes at row counts the `db-rowcount` gate has not yet demonstrated. Bound+cache achieves `O(window)` reads with zero schema change; precompute stays available as an escalation if the gate later shows multi-second bounded scans.
- **Caching alone (wrap the aggregates, leave residual queries unbounded).** Rejected: the receipt-verified cache is an ephemeral in-process Map — every cold start replays the full-partition scans, and Phase 6 multiplies cold paths per user. Violates the binding bound+cache complement rule.
- **Dropping the `gte: Jan 1(year)` lower bound from the main playtime scan (the round-1 reconciliation).** Rejected on round-2 review — with the baseline decoupled into its own bounded fetch, the `gte` starves nothing; removing it leaves the dominant current-year case (`lt: Jan 1(year+1)` matches every row) as unbounded as the original DATA-3 defect, clobbers bug-3's shipped bound, and makes T5 cache an unbounded scan (the exact anti-pattern the "Caching alone" rejection below disavows). Keep bug-3's `{gte,lt}` bound intact; reconcile only the baseline's data source.
- **Deriving `baselineByApp` from the main scan's rows by widening/unbounding that scan (the naïve bug-2 merge outcome).** Rejected — the baseline needs at most one pre-year row per app; fetching all history to find it is the defect. Superseded by the separate bounded baseline fetch in pt. 1.
- **Re-implementing the idle lookback bound / `IDLE_LOOKBACK_DAYS` (the original T3).** Rejected — shipped verbatim on `fix/bug-3-insights-perf`; a divergent second bound (the +1-day variant) for the same scan is the two-fixes-one-tail anti-pattern. Margin question routed to bug-3's lane.
- **Raw SQL (`SELECT DISTINCT strftime('%Y', date)` / `date_trunc`) for DATA-5.** Rejected: dialect-divergent between dev SQLite and prod Postgres, escapes Prisma's type layer for a win Prisma-native `distinct: ['date']` already delivers on Postgres (the residual `days → years` reduction in JS is ≤ a few hundred `Date`s/year — noise).
- **New composite/covering index or migration for DATA-7.** Rejected per receipt: the indexes exist; the queries just never gave them a bound. Migrations are immutable once merged — not spending one on a non-defect.

---

## Invariants compliance

| Invariant | How this plan respects it |
|---|---|
| TTLs only in `server/cache/ttl.ts` | Exactly one new entry (`insightsAggregate`) added to the frozen `TTL` map; every `cache()` call references `TTL.insightsAggregate`. No numeric TTL literals anywhere else. Lookback constants (history 53 w/25 mo; idle's `IDLE_LOOKBACK_DAYS` is bug-3's, untouched) are **not** TTLs — domain window constants live in the pure lib modules beside their algorithms. |
| `withErrorBoundary` owns error mapping | No route handlers touched; repository functions keep throwing as today (no new try/catch). |
| Zod at every I/O boundary | No Steam I/O or request parsing is added or altered; all changes are Prisma `where`/`distinct`/`groupBy` clauses and cache wraps on already-typed rows. |
| Degrade, never crash or fabricate | Bounded windows can only shrink result sets into the routes' designed empty states — and T4 explicitly distinguishes "never had data" from "data outside the window" via an existence check so no misleading copy is fabricated. Nothing fabricated; no `{available:false}` shape change needed since these functions already return empty arrays/zero-totals for no-data. |
| `steamId` is a string | All new `where` clauses reuse the `requireSteamId(...)`-validated string `id`; cache keys embed it as a string via `cacheKey`. |
| Migrations immutable / none proposed | **Zero migrations, zero schema edits** (DATA-7 folded). |
| RSC by default, skeletons, empty states | No client components added; pages keep their route-level `loading.tsx`, bug-1's onboarding redirect gate, and designed empty states. `force-dynamic` is intentionally left in place (bug-3/Theme-3 lane). |
| Perf budget (<200 KB JS, LCP<2.5 s) | Server-only change; client JS is untouched. LCP attribution is gated on Theme 3 (see Measurement plan). |
| Snapshot semantics (monotonic playtime, day keys, idempotent jobs) | Read path only; the snapshot job and its clamping/idempotency are untouched. Bug-2's pre-year baseline is preserved exactly (explicit baseline fetch); history windows are floored to bucket boundaries so no bucket is partially fetched. |
| Cron secret / API-key server-only | Not touched. |

---

## Task breakdown

Ordering: **after the bug-1→bug-2→bug-3 merge lands** (binding precondition, see Sequencing), bounding first (T1, T2, T4 — independent of each other; T3 is verification/handoff only), caching last (T5) so the cached values are the cheap bounded computations from day one. T6 is the docs sweep. Each task is one implementer session, test-first.

### T1 — Reconcile `getYearInReview` bounding with bug-2's baseline; bound the unlock scan (DATA-3; dissolves COMP-8)
**Precondition:** bug-2 + bug-3 merged (IMPLEMENTATION.md §2); the merged file contains both bug-2's `baselineByApp` derivation and bug-3's `gte/lt` playtime bound — a combination that silently starves the baseline.
**Scope in:** `server/repositories/insights/year-in-review.ts` (the `getYearInReview` export only); new unit tests.
**Scope out:** `lib/insights/year-in-review.ts` (pure module unchanged — `computeYearInReview`'s 5-arg baseline signature and internal filter stay as-is), `getAvailableReviewYears` (T2), page files, schema.
Work: (a) on the main playtime scan, **keep bug-3's shipped full bound `date: { gte: Jan 1(year), lt: Jan 1(year+1) }` unchanged** — do not loosen either edge; (b) replace bug-2's in-memory baseline-derivation **source** (pre-year rows from an unbounded fetch) with an **explicit bounded pre-year baseline fetch**: `groupBy(['appId'], where: { steamId: id, date: { lt: yearStart } }, _max: { date } )` + keyed fetch of those `(appId, maxDate)` rows (or equivalent two-step indexed read) → `baselineByApp` identical to deriving from full history; (c) add `unlockedAt: { gte: yearStart, lt: yearEnd }` to the unlock scan (unbounded on all branches; `@@index([steamId, unlockedAt])` prunes). `appIds`/`game.findMany` shrink automatically.

**Acceptance criteria**
- The main playtime `findMany` carries **both** bounds — `gte: Jan 1(year)` and `lt: Jan 1(year+1)` (bug-3's shipped bound, byte-preserved) — AND a separate bounded baseline fetch exists (`lt: yearStart` only, via `groupBy`+keyed fetch or equivalent) returning at most one row per app; `baselineByApp` is sourced exclusively from the baseline fetch, never from the main scan's rows.
- `baselineByApp` is byte-identical to bug-2's full-history derivation for fixtures with: pre-year rows for some apps, no pre-year rows (partial-year caveat preserved), multiple pre-year rows per app (latest wins), and a row at exactly `Dec 31 23:59:59.999 UTC` vs `Jan 1 00:00 UTC` (strictly-before boundary).
- Unlock `findMany` carries the `unlockedAt` `gte/lt` range; boundary events behave correctly (Jan 1 00:00 UTC of `year` included; of `year+1` excluded).
- With seeded rows across ≥2 years plus pre-year baselines, `getYearInReview(id, y)` output is byte-identical to the **post-merge bug-2 semantics** (year gain = in-year max − pre-year baseline; `unlockedAt`-event counting; 1970-epoch guard) — pinned against a bug-2-derived expected object, NOT against within-year max−min.
- The `game.findMany` `appId: { in: ... }` list contains only appIds present in the fetched playtime rows (asserted via Prisma mock capture).
- bug-2's own test suite (baseline totals, e.g. 250-not-150) and bug-3's date-bound-era tests (updated where they pinned the now-removed `gte`) green; `pnpm typecheck`, `pnpm lint`, full `pnpm test` green.

### T2 — DB-side DISTINCT in `getAvailableReviewYears` (DATA-5)
**Scope in:** `server/repositories/insights/year-in-review.ts` (the `getAvailableReviewYears` export only); unit tests.
**Scope out:** `lib/insights/year-in-review.ts` `availableYears` (unchanged), review page.
Replace the bare `findMany` with `findMany({ where: { steamId: id }, distinct: ['date'], select: { date: true } })`.

**Acceptance criteria**
- The Prisma call includes `distinct: ['date']` (asserted via mock capture); rows **hydrated** per call drop from `games × days` to `days` on a seeded multi-game fixture (on SQLite the dedupe may happen in the query engine — the assertion targets returned/materialized rows, not claimed SQL-level transfer; see Measurement).
- Returned years identical to before for: multi-year data, single-day data, empty table (`[]`), and a fixture with a gap year (no phantom years).
- `/review/[year]` year-nav behavior unchanged (existing integration/page tests stay green).

### T3 — Idle bound: adopt bug-3's shipped fix; hand the margin question to bug-3's lane (DATA-2)
**Scope in:** verification only — no production code changes. One regression test (if not already present in bug-3's suite) pinning the shipped behavior: `getIdleFlags`' playtime `findMany` carries `date: { gte: since }` with `since = now − IDLE_LOOKBACK_DAYS` days, and `IDLE_LOOKBACK_DAYS` is imported from `lib/insights` (single source — `rg IDLE_LOOKBACK_DAYS` shows exactly one definition).
**Scope out:** `server/repositories/insights/idle.ts` query, `lib/insights/idle.ts`, `dismissIdleFlag`, `/insights/idle` page, DismissFlagButton — all bug-3's shipped surface, diff-frozen here.
**Lane handoff (recorded, not implemented):** bug-3's `gte: since` cutoff means a snapshot pair straddling the cutoff loses its predecessor, so a spike whose `fromDate` falls on the cutoff day may go undetected — a potential one-day detection gap at the window edge. If confirmed, the fix (a +1-day fetch margin) belongs to **bug-3's bound in bug-3's lane** as a follow-up amendment, so exactly one implementation of the idle bound ever exists. Theme 1 files the observation with a reproducing fixture sketch; it does not ship a competing bound.

**Acceptance criteria**
- Zero diff in `server/repositories/insights/idle.ts` and `lib/insights/idle.ts` attributable to Theme 1 (pre-T5; T5 adds only the cache wrap in the repo file).
- Regression pin test present and green; `rg IDLE_LOOKBACK_DAYS` shows one definition (in `lib/insights`) and imports only.
- Margin observation recorded in the workstream state + bug-3 lane handoff note (T6 carries it into docs/ERROR.md cross-ref if bug-3's lane confirms).

### T4 — Windowed `getPlaytimeSnapshots` for `/history` (DATA-6)
**Precondition:** bug-1 merged — the page has the `getOnboardingStatus()` redirect gate and `lib/history/aggregate.ts` has the `aggregateByDay` short-span fallback. T4 is specified against that file state.
**Scope in:** `server/repositories/snapshots.ts` (`getPlaytimeSnapshots` gains optional `opts?: { since?: Date }`), `lib/history/aggregate.ts` (exported per-bucket lookback constants, e.g. `HISTORY_LOOKBACK: { week: 53, month: 25 }` in bucket units + a helper computing `since` = lookback **floored to the bucket boundary** — ISO week start / month start, matching `aggregatePlaytime`'s bucketing), `app/history/page.tsx` (pass the computed `since` after the onboarding gate; add the zero-in-window existence check); unit + page tests.
**Scope out:** `getFirstSeenDates`, `getLibraryWithAcquisition` (must keep full-history semantics — `acquiredAt` inference depends on it), `aggregatePlaytime` bucketing math, bug-1's `aggregateByDay` fallback, `PlaytimeChart`/`HistoryToggle`, the onboarding redirect gate.
**Regression guard:** bug-1's post-merge behavior must survive: not-onboarded → redirect (never an empty state); short-span data → `aggregateByDay` fallback still draws.
**Window-edge correctness (replaces the earlier "margin pair" rationale, which misread the aggregator):** `aggregatePlaytime` bucket totals are intra-bucket `Σ(max−min)` — self-contained, no cross-bucket baseline. The genuine requirement is that `since` lands **on a bucket boundary** so the oldest rendered bucket gets all of its rows; a mid-bucket `since` under-counts the first bar. No "+1 bucket margin" is needed or added.
**Pre-window-only data (new case, must not regress into a bug-1-class bug):** an onboarded user whose only snapshots predate the window would fetch zero rows. "No history yet" (= no snapshots exist at all) is wrong for them. When the windowed fetch is empty, run a cheap existence probe (`prisma.playtimeSnapshot.findFirst({ where: { steamId }, select: { appId: true } })` — indexed, one row; `PlaytimeSnapshot` has a compound PK `@@id([steamId, appId, date])` and **no scalar `id` field** (schema.prisma:105-114), so selecting `id` would not typecheck — `count` on `{ steamId }` is an acceptable alternative): exists → render the window-accurate quiet state (reuse "History is still building" or copy reviewed in-task, e.g. "No playtime recorded in the last N weeks"); not exists → the true "No history yet" state (unreachable in practice behind the onboarding gate, kept as defense).

**Acceptance criteria**
- `getPlaytimeSnapshots(id)` with no `since` is byte-identical to today (existing tests unchanged); with `since`, the `findMany` carries `date: { gte: since }` and `orderBy` is preserved.
- The `since` helper returns a bucket-boundary-floored date: for `week`, an ISO week start ≥ 53 weeks back; for `month`, a month start ≥ 25 months back (unit-tested against fixed clock fixtures, including a "now = mid-bucket" case).
- `/history?bucket=week` fetches only rows within the floored window; `?bucket=month` likewise (mock capture).
- Chart points for data fully inside the window are identical pre/post change; the **oldest rendered bucket's total is identical** to the unwindowed computation for a fixture whose data spans the window edge (this is the bucket-completeness test — red if `since` is not floored).
- Onboarded user, snapshots only before the window → windowed fetch empty → existence probe fires → "History is still building"/window-accurate copy rendered, **not** "No history yet" (explicit fixture).
- Not-onboarded → redirect to `/onboarding` (bug-1 gate untouched, test green); short in-window span → `aggregateByDay` fallback still draws (bug-1 fallback test green).
- `getFirstSeenDates` output unchanged (its `groupBy` does not go through `getPlaytimeSnapshots` — asserted by leaving its tests untouched and a grep-level check in review).

### T5 — Cache the aggregates (DATA-4)
**Scope in:** `server/cache/ttl.ts` (add `insightsAggregate` entry — the ONLY file where the number lives), `server/repositories/insights/idle.ts` (cache wrap only — the query and constants are bug-3's, diff-frozen otherwise), `server/repositories/insights/year-in-review.ts` (both exports), `server/repositories/insights/cost-per-hour.ts`, `server/repositories/insights/genres.ts` (outer wrap; the inner SteamSpy `cache()` at genres.ts:96 stays exactly as-is — bug-3/bug-5 lane, do not touch its key or TTL), `server/repositories/snapshots.ts` (`getPlaytimeSnapshots` cached only on the `since`-parameterized path used by `/history`, key includes the window); unit tests.
**Scope out:** `server/cache.ts` internals and any durable-backend decision (bug-3's lane — this task only calls the existing `cache()` API), `force-dynamic` flags (Theme 3/bug-3 lane), route handlers.
Key shapes (all via `cacheKey`): `insights-idle:<steamId>:<thresholdMinutes>` (**threshold included** — the cached stage runs `detectIdleSpikes(rows, thresholdMinutes)` and its output varies with the threshold; the default is resolved before keying so omitted and explicit-default calls share one entry), `insights-year-in-review:<steamId>:<year>`, `insights-review-years:<steamId>`, `insights-cost-per-hour:<steamId>`, `insights-genres:<steamId>`, `history-snapshots:<steamId>:<windowCode>`.
**Critical sub-design:** in `getIdleFlags`, only the snapshot→`detectIdleSpikes` stage is inside the cache; the `idleDismissal` fetch + filter + `game.findMany` name lookup run per-request outside it, so `dismissIdleFlag` is visible immediately (no invalidation machinery needed).
**Cross-test cache pollution (binding on implementation):** the wrapped functions are already exercised by `insights-repo-idle.test.ts`, `insights-repo-year-in-review.test.ts`, `insights-repo-cost-per-hour.test.ts`, `insights-repo-genres.test.ts` — each of those suites (and any new suite touching wrapped functions) must call `clearCache()` in `beforeEach`, or a later case gets a warm-cache hit and asserts wrong Prisma call counts.
**Merge coordination:** Theme 2 adds `achievementSchema`/`achievementGlobal` entries to the same frozen `TTL` map; keys are disjoint — resolve the shared-file conflict take-both, no semantic reconciliation.

**Acceptance criteria**
- Exactly one new key in `TTL`; `rg '21600|TTL\.insightsAggregate'` shows the literal only in `ttl.ts`.
- Second call to each wrapped aggregate with a warm cache performs zero Prisma calls for the cached stage (mock call-count assertions per function).
- Dismissing an idle flag is reflected on the immediately following `getIdleFlags` call despite a warm cache (regression: dismiss UX).
- Different `steamId` / `year` / bucket-window / **`thresholdMinutes`** values never share a cache entry; two `getIdleFlags` calls with different thresholds invoke the loader twice and return threshold-correct flags (key-isolation tests, threshold case explicit).
- `getIdleFlags(id)` and `getIdleFlags(id, DEFAULT_IDLE_THRESHOLD_MINUTES)` share one cache entry (default-resolution test).
- Stale-while-revalidate preserved: loader throw with a prior cached value returns `stale` semantics per existing `cache()` contract (covered by existing cache tests; one integration assertion that wrapping didn't bypass it).
- `clearCache()` added to `beforeEach` of every pre-existing suite exercising a wrapped function; full suite green in any test order.
- bug-3 (insights-slow) and bug-5 (insights-unknown-label) test suites green; the genres inner SteamSpy cache call is diff-untouched.

### T6 — Documentation sweep (Documentation Rule)
**Scope in:** `docs/BACKEND.md` (bounded-read + aggregate-cache pattern, new TTL key, cache-key table incl. threshold discriminator), `docs/DATA_MODEL.md` (note: indexes now actually pruned by bounded reads; explicitly record "no schema change"), `docs/FRONTEND.md` (history window semantics — 53 w/25 mo, bucket-boundary flooring — the pre-window quiet state vs "No history yet" distinction, and idle lookback surfaced in page copy if adjusted), `docs/ERROR.md` (one ERR-XXXX entry per the About-Errors rule capturing the generalized rule: "never issue a steamId-only `findMany` on an append-only snapshot table; always pass the rendering window so composite indexes prune — and when a window empties a result, distinguish 'no data ever' from 'no data in window' before choosing empty-state copy"), `wayline/optimization` state per workstream convention (including the T3 margin handoff to bug-3's lane).
**Scope out:** `docs/API.md` (no public `/api/*` contract changes — verify and state so), ADRs (no architecture decision was made that isn't already ADR'd; the durable-cache ADR belongs to bug-3's lane).

**Acceptance criteria**
- Every file changed in T1–T5 has its governing doc updated in the same PR series; docs mention the gated `db-rowcount` follow-up and the bug-3-lane margin handoff.
- ERR entry appended with index-table row, never edits to prior entries.

---

## TDD test plan

Failing tests written first, red→green per task (against the post-merge tree):

| # | File | Test name | Asserts (red → green) |
|---|---|---|---|
| 1 | `tests/unit/year-in-review-repo.test.ts` (extend existing repo tests or create) | `getYearInReview playtime scan keeps pre-year rows out of the main fetch but baseline fetch supplies them` | Mock captures: playtime `where.date` has `lt` = Jan 1(year+1) and **no `gte`**; baseline query bounded `lt` = Jan 1(year). Red on the merged tree: hard `gte` present, no baseline fetch. |
| 2 | same | `getYearInReview bounds unlock scan by unlockedAt` | Mock captures `where.unlockedAt.gte/lt`. Red: absent (unbounded on all branches). |
| 3 | same | `game name lookup only covers the fetched playtime rows' appIds` | With 2-year fixture, `game.findMany` `in` list excludes apps present only outside the fetched window. Red: includes them. |
| 4 | same | `bug-2 baseline semantics preserved under bounding` | Expected object pinned to **in-year max − pre-year baseline** (bug-2/ERR-0019 semantics), incl. partial-year caveat when no baseline exists and latest-pre-year-row-wins. **Red on the naïve merged tree** (hard `gte` empties `baselineByApp` → totals fall back to in-year max−min). |
| 5 | same | `getAvailableReviewYears requests distinct dates only` | Mock captures `distinct: ['date']`. Red: absent. |
| 6 | same | `available years unchanged incl. gap years and empty table` | `[2026, 2024]`-style expectations; `[]` on empty. Pinned regression. |
| 7 | `tests/unit/idle-repo.test.ts` (extend) | `getIdleFlags keeps bug-3's shipped bound (regression pin)` | Mock captures `where.date.gte` ≈ now − `IDLE_LOOKBACK_DAYS` days, constant imported from `lib/insights`. Green from the start on the merged tree — pinned so Theme 1 cannot drift it. (No re-implementation reds; the margin fixture sketch is attached to the bug-3 lane handoff, not asserted here.) |
| 8 | `tests/unit/snapshots-repo.test.ts` (extend existing snapshot tests) | `getPlaytimeSnapshots passes date gte when since is provided` | Mock capture. Red: no `date` in `where`. |
| 9 | same | `getPlaytimeSnapshots without since is unchanged` | Captured `where` = `{ steamId }` only. Pinned regression. |
| 10 | `tests/unit/history-aggregate.test.ts` | `since helper floors to bucket boundary` | Fixed-clock fixtures: mid-week/mid-month "now" → returned `since` is an ISO week start / month start ≥ lookback. Red: raw `now − lookback` (unfloored). |
| 11 | same | `oldest rendered bucket total matches unwindowed computation` | Fixture spanning the window edge: bucket totals for the first in-window bucket identical windowed vs unwindowed (buckets are intra-bucket Σ(max−min), so completeness — not a cross-bucket pair — is what's at stake). Red if `since` is mid-bucket. |
| 12 | `tests/unit/history-page.test.tsx` (extend the bug-1 suite) | `history page fetches only the per-bucket window and keeps bug-1 behavior` | Page passes computed floored `since`; not-onboarded → redirect (bug-1 gate); short-span → `aggregateByDay` fallback draws. Red on the `since` half; bug-1 halves pinned green. |
| 13 | same | `pre-window-only data renders quiet state, not "No history yet"` | Onboarded fixture, all snapshots older than window → existence probe fires → "History is still building"/window-accurate copy; no-snapshots fixture → "No history yet". Red: windowed empty result falls through to "No history yet". |
| 14 | `tests/unit/insights-cache.test.ts` (new) | `each aggregate hits Prisma once across two calls (warm cache)` | Per-function Prisma mock call counts: 1 not 2. Red: 2. |
| 15 | same | `idle dismissal visible immediately despite warm cache` | dismiss → next `getIdleFlags` excludes the flag. Red if the dismissal filter was cached. |
| 16 | same | `cache keys isolate steamId, year, history window, and idle threshold` | Distinct args → distinct loader invocations, same args → shared; explicit case: `getIdleFlags(id, 30)` vs `getIdleFlags(id, 120)` → two loader runs, threshold-correct results; `getIdleFlags(id)` vs `getIdleFlags(id, DEFAULT_IDLE_THRESHOLD_MINUTES)` → one entry. Red on key collisions / missing threshold discriminator. |
| 17 | same | `TTL.insightsAggregate exists and wraps use it` | Type-level + call-arg assertion. Red: key missing from `TTL`. |

Existing suites that must stay green throughout (regression net): `history-aggregate.test.ts`, bug-1/2/3/5 suites (bug-2's baseline totals and bug-1's redirect/fallback especially), `cache.test.ts`, `cache-single-flight.test.ts`, `DismissFlagButton.test.tsx`, `ReviewCover.test.tsx`, `tests/integration/snapshot.test.ts`, and the pre-existing insights repo suites (`insights-repo-idle`, `insights-repo-year-in-review`, `insights-repo-cost-per-hour`, `insights-repo-genres`) — each gains `clearCache()` in `beforeEach` when T5 lands (see T5).

---

## Affected files

Verified against HEAD and the three fix branches; final line numbers to be re-anchored on the merged tree.

**Modified (code):**
- `server/repositories/insights/year-in-review.ts` — `getAvailableReviewYears`, `getYearInReview` (post-merge reconciliation: drop `gte`, keep `lt`, add bounded baseline fetch, bound unlock scan) — T1, T2, T5
- `server/repositories/insights/idle.ts` — **T5 cache wrap only**; bug-3's query, bound, and dismissal logic diff-frozen (T3 is verification-only)
- `server/repositories/insights/cost-per-hour.ts` — `getCostPerHour` — T5
- `server/repositories/insights/genres.ts` — `getGenreBreakdown` outer wrap only; inner `cache()` at :96 untouched — T5
- `server/repositories/snapshots.ts` — `getPlaytimeSnapshots` gains `opts?: { since?: Date }` — T4, T5 (`getFirstSeenDates`, `getLibraryWithAcquisition` untouched)
- `lib/history/aggregate.ts` — add lookback constants + bucket-boundary-floored `since` helper; `aggregatePlaytime` and bug-1's `aggregateByDay` untouched — T4
- `app/history/page.tsx` — pass computed `since` after bug-1's onboarding gate; add zero-in-window existence probe + quiet-state branch — T4
- `server/cache/ttl.ts` — one `insightsAggregate` entry (take-both merge with Theme 2's disjoint keys) — T5

**Explicitly NOT modified:**
- `lib/insights/idle.ts` (bug-3 already exports `IDLE_LOOKBACK_DAYS`; Theme 1 adds nothing — the earlier plan to add the constant here is withdrawn)
- `lib/insights/year-in-review.ts` (pure module: `availableYears`, `computeYearInReview` incl. bug-2's 5-arg `baselineByApp` signature and internal year filter — kept as defensive contract)
- `prisma/schema.prisma` and `prisma/migrations/**` (zero migrations)
- `server/cache.ts` (backend decision is bug-3's lane)
- `app/insights/idle/page.tsx`, `app/review/[year]/page.tsx` (call sites unchanged; `force-dynamic` untouched — Theme 3/bug-3 lane)
- `server/jobs/**` (write path untouched)

**Tests (new/extended):** `tests/unit/year-in-review-repo.test.ts`, `tests/unit/idle-repo.test.ts` (pin only), `tests/unit/snapshots-repo.test.ts`, `tests/unit/history-aggregate.test.ts`, `tests/unit/history-page.test.tsx` (names to be reconciled with existing suite layout at implementation time), `tests/unit/insights-cache.test.ts` (new), plus `clearCache()` `beforeEach` additions to the four pre-existing insights repo suites.

**Docs:** `docs/BACKEND.md`, `docs/DATA_MODEL.md`, `docs/FRONTEND.md`, `docs/ERROR.md` — T6.

---

## Measurement plan

**Confound warning (binding, from SUMMARY):** the shell (RSC-1/2, Theme 3) gates first paint on Steam I/O, so **LCP/TTFB before-after numbers for these routes are confounded until Theme 3 lands.** Theme 1's proof metrics are therefore *server-side*, independent of the shell: rows transferred/hydrated and repository wall time. "Before" baselines are captured on the **post-bug-1/2/3-merge tree** (not `13023e3`), so bug-3's already-shipped bounds are not double-counted as Theme 1 wins.

**Primary metrics (per surface, before → after, recorded in `wayline/optimization/measurements/theme-1.md`):**
1. **Rows hydrated per render** — Prisma query-event logging (`log: ['query']` in a measurement harness) or mock-capture counts in integration tests: `/review/[year]` (playtime + baseline + unlock scans), `/history` per bucket. Expected: review playtime `games×days_total` → `games×days_year + games (baseline rows)`; unlocks all-time → in-year; history `games×days_total` → `games×days_window`. **DATA-5 caveat:** on SQLite, `distinct` may be applied in Prisma's query engine, not as SQL `DISTINCT` — record *hydrated-row* reduction (guaranteed) separately from *DB-transfer* reduction (expected on Postgres, verify there); do not report the "67× smaller" figure as a SQLite table-scan claim.
2. **Repository wall time** — `performance.now()` around `getYearInReview`+`getAvailableReviewYears`, `getPlaytimeSnapshots` on a seeded large fixture (synthetic: 67 games × 3 years of daily rows ≈ 73k rows in a scratch SQLite DB) — makes the growth projection measurable *today* without prod access. Same harness re-run post-fix. (`getIdleFlags` timing is bug-3's shipped win; measure only T5's cache delta on it.)
3. **Cache hit behavior** — second-request Prisma call count = 0 for cached stages (T5 tests double as the measurement).

**Interaction note (Theme 5):** Theme 5's T1 bounds `recordAchievementUnlocks` with day-keyed rotation, which can delay `AchievementUnlock` rows for cold games and reduce Year-in-Review unlock counts for up to ceil(R/LIMIT) nights after onboarding. Theme 1's equality tests seed unlock rows directly and are unaffected, but live before/after unlock-count measurements taken during that window would be confounded — note the window in the measurements file (Theme 5 documents the mechanism).

**Gated checks carried forward (human/live lane — preserve verbatim from the receipt; they set urgency, not correctness):**
- **`db-rowcount`** — `SELECT steamId, COUNT(*) FROM "PlaytimeSnapshot" GROUP BY steamId ORDER BY 2 DESC LIMIT 5;` and same for `"AchievementUnlock"` against prod/staging. Settles the DATA-2/3/6 PLAUSIBLE magnitudes and calibrates whether the synthetic 73k-row fixture is realistic. Does **not** gate whether T1/T2/T4 ship (mechanism is confirmed; cost is monotonic in time so the fix is warranted regardless) — it gates whether escalation to nightly precompute is ever needed.
- **`timing`** — Vercel function-duration traces (or `performance.now()`) for `/insights/idle`, `/review/[year]`, `/history` before/after, compared against ERR-0011's recorded figures. Run only after Theme 3's shell fix to avoid confounding, or read repository-scoped timings instead.
- **`prod-cache-durability`** (inherited from bug-3) — whether prod is single-instance Map-only. Determines T5's real-world hit rate; the wrap is correct either way and upgrades for free when bug-3's lane lands a durable backend.
- Context values that scale the numbers, recorded alongside: `ENABLE_STEAMSPY` prod value (bug-3 gate — decides whether genres timing is dominated by the fan-out, off by default), platform tier / function timeout, real library N (all math above assumes the 65–67-game seed).

---

## Risk & rollback

**Regression surface — the 5 shipped bug fixes:**
- **bug-1 (history-no-data):** highest-risk interaction — T4's window creates a new empty-result path. Mitigations, all in acceptance: not-onboarded → redirect gate untouched; short-span → `aggregateByDay` fallback untouched; **pre-window-only data → existence probe distinguishes "no data ever" from "no data in window"** so "No history yet" is never shown to a user with history (explicit fixture, TDD #13).
- **bug-2 (year-in-review-zero-hours / ERR-0019 baseline):** the sharpest edge in this theme — the naïve bug-2+bug-3 merge silently starves `baselineByApp`. T1's whole purpose is reconciling it: upper-bound-only main scan + explicit bounded baseline fetch, pinned byte-equality against **bug-2 semantics (in-year max − pre-year baseline)**, boundary-timestamp tests on the strictly-before edge (TDD #1/#4).
- **bug-3 (insights-slow):** overlapping by design, resolved by ownership: bug-3 owns the idle bound, `IDLE_LOOKBACK_DAYS`, the YiR playtime year-bound mechanism, the SteamSpy fan-out, `ENABLE_STEAMSPY`, and `server/cache.ts` internals. Theme 1 adopts (T3), reconciles where bug-2 requires it (T1 — modifying the bound's lower edge with bug-2-pinned tests as the contract), and adds only what bug-3 didn't ship (unlock-scan bound, DISTINCT, history window, aggregate caching). The genres inner cache call is diff-frozen (T5 acceptance); the idle margin question is handed to bug-3's lane, never forked (T3).
- **bug-4 (obs-software-title):** untouched surface (game-title mapping); no shared files.
- **bug-5 (insights-unknown-label):** genres labeling depends on the SteamSpy lookup path, which is unchanged; the outer wrap caches the labeled result as-is (suite must stay green per T5 acceptance).

**Other risks:**
- **Semantic narrowing (history window)** — intentional product change; documented in T6, constants tunable in one place; bucket-boundary flooring prevents silent under-count of the oldest bar; pre-window probe prevents misleading copy.
- **Stale insights up to TTL** — bounded at 6 h against nightly-write snapshot data (max staleness < one snapshot cycle). **Caveat:** `getCostPerHour`/`getGenreBreakdown` inputs (OwnedGame playtime, Game price/genre) can also change via ad-hoc sync/resync, so a user who resyncs may see up to 6 h-stale cost/genre insights until TTL expiry — accepted degradation, documented in T6; explicit invalidation-on-sync is a follow-up if it annoys in practice. Dismissals exempted by design (outside cache).
- **Prisma `distinct` on SQLite** — may be applied in the query engine rather than as SQL `DISTINCT` (see Chosen fix pt. 2 and Measurement #1): the hydration win holds everywhere; the DB-transfer win is a Postgres claim, verified there. Strictly ≤ current cost on every connector. Integration coverage in `tests/integration/snapshot.test.ts` territory covers real SQLite.
- **Cache key collisions** — prevented by T5 key-isolation tests (steamId, year, window, **threshold**); keys follow the existing `steam:<endpoint>:<steamId>[:<n>]` namespace.
- **Cross-test cache pollution** — wrapped functions are exercised by four pre-existing suites; without `clearCache()` in `beforeEach`, warm hits break Prisma call-count assertions. Called out as binding in T5.
- **Shared-file merges** — `server/cache/ttl.ts` is also edited by Theme 2 (disjoint keys — take both); `server/repositories/insights/year-in-review.ts` and `idle.ts` arrive via the bug-merge (Theme 1 sequences after it, see Sequencing).

**Per-task rollback:** every task is an isolated, additive commit with no migration and no schema/API contract change — rollback = `git revert` of that task's commit(s), independently safe in any order except: T5-before-T1/T2/T4 reverts are safe (reverting a bounding task under T5 just re-caches the expensive computation — slower, correct); **reverting T1 alone restores the merged-tree latent bug-2 starvation** (hard `gte` + baseline derivation), so a T1 revert must also revert to — or re-apply — one of the pre-merge states, with the bug-2 suite as the gate. No data rollback ever needed (read path only).

---

## Required docs/ updates

Per the repo Documentation Rule (server-side files changed ⇒ docs updated in the same change):

- **`docs/BACKEND.md`** — new "bounded snapshot reads" convention (never steamId-only `findMany` on append-only tables; pass the rendered window; when a query needs history context — like bug-2's baseline — fetch it with its own bounded query, don't unbound the main scan), aggregate-cache pattern, `TTL.insightsAggregate`, cache-key table additions (`insights-*` incl. threshold discriminator, `history-snapshots`).
- **`docs/DATA_MODEL.md`** — note that `@@index([steamId, date])` / `@@index([steamId, unlockedAt])` are now exercised by bounded reads; record explicitly that no schema change was made (DATA-7 disposition).
- **`docs/FRONTEND.md`** — `/history` window semantics (53 w / 25 mo, bucket-boundary flooring), the "no data ever" vs "no data in window" empty-state distinction, and idle lookback surfaced in page copy if adjusted.
- **`docs/ERROR.md`** — one new ERR-XXXX entry + index row: root cause (unbounded steamId-only scans on append-only snapshot tables, uncached aggregates; plus the merge-latent bug-2/bug-3 baseline starvation T1 closes), generalized prevention rule, cross-refs to bug-3's entries (ERR-0010/0011 lineage) and bug-2's ERR-0019. Never edit prior entries.
- **`docs/API.md`** — no changes required (no public `/api/*` contract touched); T6 verifies and states this.
- **`wayline/optimization/`** — measurements file (`measurements/theme-1.md`), the T3 idle-margin handoff note to bug-3's lane, and workstream state per convention.

---

## Review record

### Round 1 — required changes (all addressed)

1. **T1 duplication/contradiction with bug-2/bug-3:** re-baselined the whole plan on the post-bug-1→2→3-merge tree (new binding "Sequencing" section). T1 no longer re-adds bug-3's `gte/lt` bound; it reconciles the merged state — upper bound (`lt: Jan 1(year+1)`) only on the main scan, explicit bounded per-app pre-year baseline fetch preserving bug-2's `baselineByApp`, plus the genuinely-unclaimed unlock-scan bound. Bug-2 semantics description corrected everywhere from "within-year max−min" to "in-year max − pre-year baseline (ERR-0019)"; byte-equality acceptance re-pinned to bug-2 semantics; TDD #1/#4 rewritten (red against the naïve merged tree).
2. **T3 duplication of bug-3's idle bound:** T3 rescoped to verification + lane handoff only — zero production diff; regression pin test on bug-3's shipped bound; the +1-day predecessor-pair margin is recorded as a proposed amendment to bug-3's bound in bug-3's lane (single-implementation rule), not implemented here. `lib/insights/idle.ts` removed from modified files. The false "never touches bug-3 ground" claim replaced with an explicit ownership map in Risk (bug-3 owns idle bound / `IDLE_LOOKBACK_DAYS` / YiR playtime bound mechanism; Theme 1 adopts, reconciles, and adds only unclaimed pieces).
3. **T4 collision with bug-1 + aggregator misread:** T4 re-specified against bug-1's merged files (onboarding redirect gate, `aggregateByDay` fallback — both diff-frozen and pinned). The "+1 bucket margin / baseline pair" rationale withdrawn as a misread (`aggregatePlaytime` buckets are self-contained intra-bucket Σ(max−min)); replaced with the genuine requirement — flooring `since` to the bucket boundary so the oldest bucket is complete — with a genuinely red-first flooring test (TDD #10/#11 replacing old #13). Pre-window-only data resolved: cheap existence probe distinguishes "no data ever" from "no data in window"; "No history yet" acceptance for zero in-window rows removed (TDD #13 asserts the distinction).
4. **T5 idle key missing threshold:** idle cache key now `insights-idle:<steamId>:<thresholdMinutes>` with default resolved before keying; key-isolation test extended with an explicit two-threshold case plus a default-sharing case (TDD #16); acceptance updated.

### Round 1 — non-blocking objections (all folded in)

- `server/cache/ttl.ts` shared with Theme 2 — take-both merge noted (Chosen fix pt. 5, T5, Risk).
- Prisma `distinct` engine-side on SQLite — hedged in Chosen fix pt. 2, T2 acceptance (hydrated-row assertion), and Measurement #1 (67× figure no longer claimed as SQLite DB-transfer).
- 6 h-stale cost/genre after ad-hoc resync — documented in Risk + T6 as accepted degradation with invalidation-on-sync as follow-up.
- Cross-test cache pollution — `clearCache()` in `beforeEach` of the four pre-existing insights suites made binding in T5 (+ regression-net note in TDD plan).
- Theme-1 ↔ Theme-5 unlock-recording freshness interaction — acknowledged in Measurement plan (tests unaffected; live measurements during the rotation window flagged as confounded).

### Unresolved objections

None. All four required changes implemented as directed; all five non-blocking objections folded into the plan body. One observation recorded for the parent lane (not a disagreement with the review): IMPLEMENTATION.md §2's claim that bug-3's YiR bound "composes" with bug-2's baseline is incorrect for the reason the reviewer identified (the hard `gte` starves `baselineByApp`); T1 is scoped to close that merge-latent regression, and the T6 ERR entry records it.

### Revision history

- **Round 1 (2026-07-09):** re-baselined plan on post-bug-1/2/3-merge tree with explicit sequencing section; T1 rewritten as merge reconciliation (upper-bound + bounded baseline fetch + unlock bound) with bug-2 semantics corrected; T3 rescoped to verification-only with idle-margin handoff to bug-3's lane; T4 re-specified on bug-1's merged files with bucket-boundary flooring replacing the mistaken margin-pair rationale and a pre-window existence probe; T5 idle key gains `thresholdMinutes` + threshold isolation test; folded in ttl.ts merge note, SQLite `distinct` hedge, resync staleness risk, `clearCache()` requirement, and Theme-5 interaction note; TDD table, affected files, measurement, risk, and docs sections updated to match.
