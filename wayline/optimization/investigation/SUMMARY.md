# Optimization investigation — cross-theme synthesis

> **Phase 1: Investigate (complete).** Read-only root-cause loop over the 27 finding IDs in
> [../FINDINGS.md](../FINDINGS.md): 5 theme scouts (Opus, low effort) + 1 adversarial reviewer
> pass per theme (Opus, high effort, separate context), pipelined with no barrier.
> Branch `altan/optimization` · HEAD `13023e3` · 2026-07-09 · 10 agents, 0 failures.
>
> Scout reports: `investigation/theme-{1..5}-*.md` · Reviewer receipts: `verification/theme-{1..5}-*.evidence.md`
> No fixes proposed here — the human gate to the planning phase comes after this report.

## Adjudication scoreboard — every ID carries a reviewer verdict

**27/27 adjudicated: 16 CONFIRMED · 9 PLAUSIBLE · 2 REFUTED.**
PLAUSIBLE = mechanism independently reproduced in source, but absolute magnitude depends on
runtime data unreadable from code (prod row counts, timing traces, platform tier). Every
PLAUSIBLE verdict has a named gated check in its receipt.

| Theme | ID | Reviewer verdict | One-line adjudication |
|---|---|---|---|
| 1 | DATA-2 / COMP-2 / RSC-4 | PLAUSIBLE | Unbounded idle scan + JS recompute confirmed in code; magnitude gated on prod row count (dev DB has 67 rows/1 day). |
| 1 | DATA-3 / COMP-1 / RSC-7 | PLAUSIBLE | Doubly unbounded (playtime + achievement-unlock scans) confirmed; magnitude gated. Reviewer added a third O(games) query the scout missed. |
| 1 | DATA-6 / COMP-3 / RSC-5 | PLAUSIBLE | History-page unbounded scan confirmed; genuinely **new vs bug-3** (bug-3 never cites `snapshots.ts`). |
| 1 | DATA-4 | CONFIRMED | Zero `cache(...)` on any insights aggregate; only cache call is the inner SteamSpy lookup. 100% recompute per visit. |
| 1 | DATA-5 / COMP-4 | CONFIRMED | DISTINCT-in-application; `/review` scans the full per-user partition **twice** per load (with DATA-3). |
| 1 | DATA-7 | CONFIRMED | Schema fact, but reframed: consequence of unbounded queries, **not** an independent defect — the index exists; bounding the queries makes it prune. No new index needed. |
| 1 | COMP-8 | CONFIRMED | Low-severity JS symptom of DATA-3; disappears once DATA-3 is bounded. |
| 2 | STEAM-1 | CONFIRMED | `/library?multiplayer=1` fans out one Store call/game, storeLimiter-serialized: ~16.3 s cold @ 65 games. No `categoryIds` precompute exists (unlike genres/price). |
| 2 | STEAM-2 / DATA-8 | CONFIRMED | Dashboard achievement fan-out real but **already mitigated**: top-20 cap, private-profile short-circuit, Suspense, single-flight, 1 h TTL. Residual: still serial, ~15 s cold worst case off first paint. |
| 2 | STEAM-3 / DATA-1 / RSC-3 | CONFIRMED | The exact bug-3 remnant: 65 × 1 s SteamSpy serial when `ENABLE_STEAMSPY=1` (ERR-0011 measured 64.8 s); flag defaults OFF → dormant. |
| 2 | STEAM-4 | CONFIRMED | `steamLimiter` = one process-global capacity-1 bucket, single FIFO queue, no per-user partitioning. Contention multiplier: C users × k calls × 250 ms serialized per instance. |
| 2 | STEAM-5 | PLAUSIBLE | Retry schedule = +5.25 s per terminally-failing call verified; acquire outside retry (no token waste); only Web API retries. Gated on prod transient-failure rate. |
| 2 | STEAM-9 | CONFIRMED | Structural: Steam appdetails has no batch endpoint → every Store consumer is O(N) unless precomputed (pattern proven in ERR-0010/0011). |
| 3 | RSC-1 | CONFIRMED | Root layout Sidebar awaits `getViewerSteamId` → `getProfile` (2 limiter-gated Steam calls) with **no Suspense anywhere in the shell** — document flush gated on Steam. |
| 3 | RSC-2 | CONFIRMED | Header adds `getLevel` (3rd distinct Web API call). Reviewer **corrected the scout's cost model upward**: all 3 calls share one 250 ms bucket → acquires serialize at 0/250/500 ms, so the cold floor is ~500 ms + last RTT (worse than max-of-calls), retry tail up to 5.25 s. |
| 3 | RSC-6 | CONFIRMED | cost-per-hour: force-dynamic + serial awaits + no in-page Suspense — already settled by bug-3 #2/#5; cheap DB work, the cost is the blocking pattern. |
| 3 | RSC-8 | CONFIRMED (low) | 4 serial awaits on `/u/[steamId]` verified, but the ordering is a mandated IDOR/authz boundary — only ~tens of ms (session ∥ user-lookup) is sheddable. |
| 3 | RSC-9 | **REFUTED** | No duplicate store fetch: 3 call sites (reviewer found one more than the scout) all collapse to one cache key via single-flight + 7-day TTL + owned-path guard → ≤1 upstream fetch. The route is the repo's **positive** Suspense example. |
| 4 | FE-1 | CONFIRMED | Whole filtered library serialized into the `'use client'` payload; slice bounds DOM only. Reviewer strengthened it: **three** unused fields serialized (`iconUrl`, `lastPlayed`, `acquiredAt`), and re-ship on nav is caused by `force-dynamic`, not the remount key. |
| 4 | FE-2 | PLAUSIBLE | Uncapped achievement rows verified (~8 nodes/row, lazy images); magnitude gated on per-game achievement-count distribution. |
| 4 | FE-3 | PLAUSIBLE | Uncapped shared-games rows verified, server-rendered (no serialization tax); gated on real intersection sizes. Rare route. |
| 4 | FE-4 | PLAUSIBLE | Uncapped friends list verified; ceiling bounded by Steam's ~2000-friend cap, typical accounts low hundreds — lowest priority. |
| 4 | FE-5 | **REFUTED** | Not a defect: Next 14.2 default `optimizePackageImports` + per-icon ESM → only the used icons bundle (5, not 4 — immaterial). |
| 4 | COMP-7 | CONFIRMED (negligible) | Per-unlock `new Date` in hot loop verified at drifted anchor :161; cost low-ms. Reviewer corrected blast radius: `aggregateLibrary` is **not** cache-wrapped and runs ~twice per dashboard render — per-nav, not cold-only. Still negligible. |
| 5 | STEAM-7 / COMP-6 | PLAUSIBLE | Nightly achievement recording: unbounded serial fan-out on the **shared** steamLimiter, up to 3 acquires/game (~75 s @ M=100) verified; truncation risk gated on real M + platform timeout tier. |
| 5 | STEAM-8 / COMP-5 | CONFIRMED | Onboarding backfill: 3N serial upserts in one transaction + the **unbounded** achievement fan-out, awaited in the `/onboarding` RSC on first login. Reviewer corrections: it streams behind Suspense (skeleton, not frozen UI), and `force` resync is bounded to top-20 — only the first-login path is unbounded **and** uncapped (no `maxDuration`). |
| 5 | STEAM-6 | PLAUSIBLE | Nightly value pass: 2N cold storeLimiter acquisitions (price + metadata passes) sequential after the achievement work → ~150 s+/user cold job; separate bucket protects the request path. Gated on real N + tier. |

## Confirmed root causes, ranked by user-visible payoff

1. **Shell blocking on Steam I/O — RSC-1 + RSC-2 (Theme 3).** The root layout's Sidebar and
   AppHeader await three distinct Web-API calls (profile summaries, owned-games, level) through
   one capacity-1/250 ms limiter with no Suspense boundary anywhere in the shell. Every route,
   every user, every cold document load pays a ~500 ms serialized floor plus the slowest RTT
   before **anything** paints — and a single Steam transient adds up to 5.25 s of retry to the
   shell. This is the only finding that taxes literally every page view, and it masks every
   page-level win (see dependencies).
2. **Uncached, unbounded insights/history reads — DATA-4 + DATA-2/3/5/6 + DATA-7/COMP-8
   (Theme 1).** Four surfaces (`/insights/idle`, `/review/[year]`, `/history`,
   cost-per-hour by pattern) scan the full per-user `PlaytimeSnapshot` partition (twice on
   `/review`) with no date bound, recompute aggregates in JS, and cache nothing — on
   force-dynamic pages backed by an in-process-Map-only cache that cold starts empty. Cost today
   is small (dev DB: 67 rows); it grows every day the snapshot job runs and is the only theme
   whose cost is **monotonic in time**. Extends bug-3; `/history` (DATA-6) is a new instance the
   bug-3 receipt never covered.
3. **`/library` multiplayer-filter fan-out — STEAM-1 (Theme 2).** One live Store call per owned
   game, storeLimiter-serialized: ~16.3 s cold at 65 games, worse linearly with library size. The
   only remaining request-path O(N) Store fan-out, and the precompute pattern that fixed
   genres/price (ERR-0010/0011) demonstrably neutralizes it (STEAM-9 is the structural reason it
   must be precomputed).
4. **First-login onboarding wall — STEAM-8/COMP-5 (Theme 5).** The backfill runs 3N serial
   transactional upserts plus an unbounded achievement fan-out (~75 s cold at M=100) synchronously
   in the `/onboarding` render, with no `maxDuration`. Every new user hits it exactly once — at
   the worst possible moment, their first impression — with stream-truncation (partial data) as
   the failure mode. Phase 6 multiplies it by concurrent sign-ups.
5. **Cross-cutting limiter contention — STEAM-4 (+STEAM-7's job overlap).** One process-global
   Web-API bucket means any fan-out (dashboard achievements, nightly job overlapping live
   traffic) queues every other user's shell calls behind it. Not a standalone latency, but the
   multiplier that turns items 1 and 4 from per-user costs into everyone's costs. Grows with user
   count, not history.
6. **Library client payload — FE-1 (Theme 4).** Whole filtered library serialized per navigation
   (three dead fields included), re-shipped on every filter/sort change because the page is
   force-dynamic. Tens-of-KB-scale today, linear in library size; real but strictly smaller than
   items 1–4.
7. **Dormant but catastrophic when armed — STEAM-3 (Theme 2).** The bug-3 SteamSpy remnant:
   ~65 s and a function timeout if `ENABLE_STEAMSPY` is ever enabled in prod. No new work here —
   it is already the top item in the bug-3 fix direction; the plan must simply not lose it.

Residual/negligible confirmed findings, in scope for cheap cleanup only: STEAM-2 (already
mitigated; residual serialization behind Suspense), RSC-6 (folded into bug-3's Suspense work),
RSC-8 (~tens of ms), COMP-7/COMP-8 (low-ms JS), STEAM-5 (episodic retry amplification),
STEAM-6/7 (job wall-clock, off request path — matters for the cron window and Phase 6 scaling).

## Dependency notes between themes (for the planning phase)

- **The shell masks everything.** Until RSC-1/2 stop gating first paint, page-level improvements
  (Theme 1 bounding, bug-3 Suspense work) are invisible to LCP — the document doesn't flush until
  the shell's Steam calls resolve. Sequence shell streaming/deferral first, or before/after
  measurements of page fixes will be confounded.
- **Bound + cache are complements, not substitutes (Theme 1).** Caching (DATA-4) without bounding
  hides the scans until every cold start; bounding (DATA-2/3/5/6) without caching still recomputes
  per request. DATA-7 dissolves into the bounding work — the `@@index([steamId, date])` already
  exists and prunes as soon as queries pass a date bound; no migration needed. COMP-8 disappears
  with DATA-3.
- **The ephemeral-cache fact underlies Themes 1–3.** `server/cache.ts` is a pure in-process Map
  (REDIS_URL declared, read nowhere — settled in the bug-3 receipt). Every "warm cache" mitigation
  cited anywhere resets on serverless cold start. Any durable-cache decision belongs to bug-3's
  fix lane and changes the payoff math of DATA-4, STEAM-1 and STEAM-2 simultaneously.
- **STEAM-9 dictates the STEAM-1 fix shape.** No batch appdetails endpoint exists, so the only
  request-path-safe design is nightly precompute into a `Game` column (the ERR-0010/0011 pattern);
  a `Promise.all` would still serialize at the limiter.
- **Limiter fixes compound.** Shrinking request-path fan-outs (STEAM-1/2) also shrinks the
  STEAM-4 contention multiplier and frees the shared bucket the nightly job (STEAM-7) competes
  for. Conversely, Phase 6 (multi-user) amplifies STEAM-4, STEAM-7 and STEAM-8 linearly — worth
  deciding whether limiter partitioning is in scope now or deferred to Phase 6.
- **Onboarding (STEAM-8) inherits any STEAM-7 fix.** The unbounded `recordAchievementUnlocks`
  call is the shared tail of both the nightly job and first-login; bounding it once fixes both.

## Refuted and downgraded findings (kept, never deleted)

**Refuted (2):**
- **RSC-9** — no duplicate store fetch on `/game/[appId]`: three call sites collapse to one
  `store-metadata:global:<appId>` key via single-flight + 7-day TTL + owned-path guard (≤1
  upstream fetch cold). The route is the repo's model Suspense-streaming example. Drop from plan.
- **FE-5** — lucide-react named imports tree-shake correctly under Next 14.2's default
  `optimizePackageImports`. Not a defect. Drop from plan.

**Downgraded / materially corrected:**
- **DATA-7** — reframed from "missing index" to "queries don't use the existing index"; folds
  into DATA-2/3/5/6, no schema change.
- **STEAM-2** — mitigations (top-20 cap, short-circuit, Suspense, single-flight, TTL) verified
  present; residual finding only.
- **RSC-8** — serial chain is a mandated authz boundary; only the first pair is parallelizable.
- **COMP-7** — blast radius corrected to per-nav (not cache-wrapped), cost still negligible.
- **STEAM-8** — two scout overstatements corrected: onboarding streams behind Suspense (skeleton,
  not frozen), and `force` resync is top-20-bounded with `maxDuration=60`; only first-login is
  unbounded + uncapped.
- **Theme-1 magnitude claims** (DATA-2/3/6) — downgraded confirmed→PLAUSIBLE on magnitude only:
  the dev DB holds one day of snapshots (67 rows), so all "seconds today" cost figures are growth
  projections, not measurements.

## Open questions for the planning phase (gated checks, human/live lane)

1. **`ENABLE_STEAMSPY` prod value** (bug-3 carryover, 30-second check in Vercel settings) —
   decides whether STEAM-3 is dormant or the live dominant cause.
2. **Prod row counts** — `PlaytimeSnapshot` and `AchievementUnlock` per `steamId` — converts all
   three Theme-1 PLAUSIBLEs into measured costs and sets the urgency clock (how many days until
   scans are "slow").
3. **Shell timing** — one `performance.now()` around the Sidebar/AppHeader awaits or a Vercel
   function-duration trace — puts a real number on the RSC-1/2 tax (the single highest-payoff
   measurement).
4. **Platform tier / function timeouts** — Hobby 10 s vs Pro 60 s vs Fluid 300 s — decides
   whether STEAM-7/8 truncation is theoretical or live, and what `maxDuration` `/onboarding`
   needs.
5. **Prod Web-API transient-failure rate** (Vercel logs or a retry-exhaustion counter) — settles
   STEAM-5's real amplification.
6. **Real library size N and payload/DOM distributions** — actual owned-games count (all cost
   math assumes 65–67), FE-1 serialized KB on a real library, achievement-count / shared-library /
   friend-count distributions for FE-2/3/4.

— End of investigation phase. Planning is gated on human review of this report.
