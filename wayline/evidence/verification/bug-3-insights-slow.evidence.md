# Evidence — Insights pages slow: conditional SteamSpy per-game fan-out plus flag-independent unbounded snapshot scans, no in-page streaming, and ephemeral-only cache

> Read-only adversarial root-cause verification · branch `docs/bug-waylines` · 2026-06-30
>
> **Bug ID:** `bug-3-insights-slow` · **Classification:** `confirmed-code-bug` · **Confidence:** 4/5
>
> **Reviewer verdict:** `approve` · **Ready for planning:** ✅ yes · **Revise rounds:** 1

## Root cause

Two layers. (1) DOMINANT but CONDITIONAL: getGenreBreakdown awaits getSteamSpyData per owned game inside a for-loop (server/repositories/insights/genres.ts:85-108, await at :96), routed through steamSpyLimiter = TokenBucketLimiter(1, 1000) (lib/steam/limiter.ts:101, acquired steamspy-client.ts:113) => N owned games x ~1s serialized. This is gated on env.ENABLE_STEAMSPY (genres.ts:95), which defaults OFF (server/env.ts:33-36) and whose deployed value I cannot read — so its real production impact is a gatedCheck, not settled here. (2) FLAG-INDEPENDENT confirmed defects that slow insights regardless: the single real latent defect is the unbounded PlaytimeSnapshot full-table scan + per-request JS recompute — getIdleFlags (idle.ts:33-36) and getYearInReview/getAvailableReviewYears (year-in-review.ts:19-22, 38-41) all findMany with where:{steamId} only, no date bound, ignoring @@index([steamId,date]) (schema.prisma:114); O(full history), grows forever. Compounded by: no in-page <Suspense> in app/insights/* (only route-level loading.tsx skeletons exist), so each page blocks on its slowest await; a duplicate getSessionUser waterfall on the genres page (getOnboardingStatus -> getSessionUser at onboarding-gate.ts:44, then getViewerSteamId -> getSessionUser again at auth.ts:282); and dynamic='force-dynamic' on every insights page combined with a cache that is a pure in-process Map (server/cache.ts:32) with NO Redis backend at all (REDIS_URL declared at env.ts:27 but read nowhere), so every cold start recomputes from scratch.

## Evidence — every item grounded in a file:line opened this run

| File | Line | Finding |
|------|------|---------|
| `server/repositories/insights/genres.ts` | 85-108 | for (const game of ownedGames) { ... if (env.ENABLE_STEAMSPY) { const spyResult = await cache(..., () => getSteamSpyData(appId)) } } — sequential await of a SteamSpy call per owned game on the render path; gated on the ENABLE_STEAMSPY flag (line 95). |
| `lib/steam/limiter.ts` | 101 | export const steamSpyLimiter = new TokenBucketLimiter(1, 1000) — 1 req / 1000ms; the limiter (not the network) serializes the per-game fan-out into N seconds. |
| `lib/steam/steamspy-client.ts` | 113 | await steamSpyLimiter.acquire() inside getSteamSpyData — confirms every per-game call blocks on the 1 req/sec budget. |
| `server/repositories/insights/idle.ts` | 33-36 | prisma.playtimeSnapshot.findMany({ where:{ steamId: id }, select:{appId,date,playtimeForever} }) — no date bound; full per-user history scanned, then detectIdleSpikes recomputes in JS every request. (Now wrapped in Promise.all with idleDismissal — minor drift from seed.) |
| `server/repositories/insights/year-in-review.ts` | 19-22 | getAvailableReviewYears: playtimeSnapshot.findMany({ where:{steamId:id}, select:{date} }) — unbounded full scan, no year/date filter. |
| `server/repositories/insights/year-in-review.ts` | 38-41 | getYearInReview: playtimeSnapshot.findMany({ where:{steamId:id} }) — scans ALL years even though only one 'year' is rendered; ignores the date index. |
| `prisma/schema.prisma` | 114 | @@index([steamId, date]) on PlaytimeSnapshot exists but every insights query passes only steamId, so the index cannot bound the scan. |
| `app/insights/genres/page.tsx` | 35-41 | const onboarding = await getOnboardingStatus(); ... const viewerId = await getViewerSteamId(); const {...} = await getGenreBreakdown(viewerId) — three serial awaits in the page body, no in-page <Suspense>; whole page blocks on the slowest. |
| `server/onboarding-gate.ts` | 44 | getOnboardingStatus calls getSessionUser() (then user.findUnique). |
| `server/auth.ts` | 282 | getViewerSteamId calls getSessionUser() AGAIN — duplicate session resolution per genres render (waterfall). |
| `app/insights/genres/page.tsx` | 25 | export const dynamic = 'force-dynamic' (same at cost-per-hour/page.tsx:21 and idle/page.tsx:21) — no ISR/revalidate for read-mostly aggregates. |
| `server/cache.ts` | 32 | const store = new Map<string, Entry<unknown>>() — the cache is a pure in-process Map; comment at :4-5 confirms 'no Redis dependency'. REDIS_URL is declared at env.ts:27 but read nowhere in the codebase, so there is no shared/durable cache in prod — every cold start recomputes. |
| `app/review/[year]/page.tsx` | 46-50 | getViewerSteamId() then Promise.all([getAvailableReviewYears, getYearInReview]) — /review/[year] inherits the same unbounded snapshot scans + force-dynamic (line 31); confirms blast radius. |

## Stale anchors (seed line numbers that drifted vs HEAD)

| File | Claimed line | Note |
|------|--------------|------|
| `server/repositories/insights/idle.ts` | 33-36 | Content matches (unbounded playtimeSnapshot.findMany on steamId only), but it is now wrapped in a Promise.all alongside idleDismissal.findMany (lines 32-41), not a bare standalone call as the seed line range implies. |
| `server/env.ts` | 33 | Seed cites env.ts:33 for the ENABLE_STEAMSPY default-OFF; the transform spans :33-36 (z.enum(...).optional().transform(v => v==='1'\|\|v==='true')). Anchor essentially correct, range is :33-36. |
| `lib/insights/genres.ts` | 85-108 | The TASK BRIEF cites lib/insights/genres.ts for the fan-out; that is the wrong path. The actual fan-out lives in server/repositories/insights/genres.ts:85-108 (the seed wayline cites this correct path). lib/insights/genres.ts is a different/pure module. |
| `server/cache.ts` | N/A | Seed claim #5 says REDIS_URL 'may be a dev no-op in prod'. Stronger reality: there is NO Redis code path at all — server/cache.ts is always an in-process Map and REDIS_URL is never read outside env.ts. The cache is ephemeral in every environment, not just when REDIS_URL is unset. |

## Blast radius

- app/review/[year]/page.tsx — shares the unbounded PlaytimeSnapshot.findMany (steamId-only) via getAvailableReviewYears + getYearInReview AND force-dynamic; same flawed full-history-scan assumption.
- server/repositories/insights/year-in-review.ts — both exported functions scan all snapshot history with no date bound (lines 19-22, 38-41).
- All app/insights/* pages (genres, cost-per-hour, idle) — share dynamic='force-dynamic' + ephemeral in-process Map cache (no Redis), so all recompute on cold start.
- steamSpyLimiter is a global singleton (lib/steam/limiter.ts:101) — one flag-on genres render serially starves any other concurrent SteamSpy consumer (e.g. the nightly enrichment job).
- getViewerSteamId / getSessionUser duplicate-session pattern: confirmed duplicated only on the genres page (onboarding gate + viewer id). cost-per-hour, idle, and review pages call getViewerSteamId once, so the duplicate-session waterfall does NOT generalize to them.
- getGenreBreakdown is imported only by app/insights/genres/page.tsx (plus tests) — the SteamSpy fan-out is not re-used by other routes.

## Gated checks — human live lane (read-only; never run inside this verification)

### `vercel-env`
- ```
  vercel env ls production | grep -i ENABLE_STEAMSPY   # or: read Project Settings > Environment Variables
  ```
  **Expect:** If ENABLE_STEAMSPY is '1' or 'true' in production, the per-game SteamSpy fan-out is LIVE and is the dominant cause (N games x ~1s, can exceed the function timeout so the page never renders). If absent/0/false, the flag is OFF and the dominant cost shifts to the unbounded snapshot scans + force-dynamic + no streaming.

### `timing`
- ```
  Add a temporary console.time/performance.now() around getGenreBreakdown(viewerId) and around the idle/YIR playtimeSnapshot.findMany on a real authenticated render (or read the Vercel function-duration trace for /insights/genres, /insights/idle, /review/[year]).
  ```
  **Expect:** Flag-ON genres duration ≈ ownedGames.length seconds (limiter-bound). Idle/YIR duration scales with total snapshot row count for the user — confirms the O(history) scan. Compare against ERR-0011's recorded 64.8s genres / 16.3s cost-per-hour.

### `db-rowcount`
- ```
  SELECT steamId, COUNT(*) AS rows FROM PlaytimeSnapshot GROUP BY steamId ORDER BY rows DESC LIMIT 5;
  ```
  **Expect:** Reveals how many rows each unbounded findMany pulls per render. Large/growing counts confirm the snapshot full-scan is a material, ever-growing cost independent of ENABLE_STEAMSPY.

## Reviewer (adversarial, opus 4.8 · effort xhigh)

**Verdict:** `approve`

**Suite baseline:** pnpm test tests/unit/insights-genres.test.ts -> "Test Files 1 passed (1) / Tests 10 passed (10)" (Duration 734ms). Also ran tests/unit/insights-repo-genres.test.ts -> "Test Files 1 passed (1) / Tests 8 passed (8)". NOTE: insights-genres.test.ts is a PURE-LOGIC correctness suite (lib/insights aggregateBreakdown); it asserts NO latency/performance characteristic. There is NO dedicated performance/benchmark suite anywhere in tests/ (confirmed by recursive search) — there is zero perf coverage for this bug.

**Reasons / findings:**

- All 12 cited anchors re-opened and verified against HEAD (docs/bug-waylines): genres.ts:85-108 fan-out with await at :96 gated on env.ENABLE_STEAMSPY at :95; limiter.ts:101 TokenBucketLimiter(1,1000); steamspy-client.ts:113 acquire; idle.ts:33-36 unbounded playtimeSnapshot.findMany (steamId-only); year-in-review.ts:19-22 and 38-41 unbounded; schema.prisma:114 @@index([steamId,date]); genres/page.tsx:25/35/40/41 serial awaits + no in-page Suspense; onboarding-gate.ts:44 and auth.ts:282 duplicate getSessionUser; cache.ts:32 in-process Map; env.ts:27 REDIS_URL; review/[year]/page.tsx:31/46-50. None stale.
- Worker correctly flagged the one real drift in staleAnchors: idle.ts findMany is now inside a Promise.all with idleDismissal (lines 32-41), not a bare call. I confirmed this independently.
- I independently confirmed REDIS_URL appears only at env.ts:27 and is read nowhere else in source (grep across server/lib, no redis/ioredis client anywhere) — the cache is an ephemeral in-process Map in every environment, exactly as the worker's staleAnchor #4 corrects the seed.
- Classification is honest and cross-checks cleanly against docs/ERROR.md ERR-0011 (Status: Fixed, 2026-06-19): the dominant pre-fix O(N) Store-metadata/price fan-out for BOTH genres and cost-per-hour was already migrated to a read-aggregate pattern. HEAD confirms getCostPerHour does zero Store calls (reads ownedGame+Game) and getGenreBreakdown reads Game.genres; the ONLY residual render-path fan-out is the SteamSpy tags loop gated on the default-OFF ENABLE_STEAMSPY flag — which ERR-0011 explicitly names as the known ticketed follow-up. The worker correctly demotes this to a CONDITIONAL gatedCheck (prod env value unknown) rather than a settled dominant cause, and isolates the flag-independent confirmed defects (unbounded snapshot scans, force-dynamic, ephemeral cache, no in-page streaming).
- No runtime fact is smuggled into 'evidence': every latency, DB row-count, and prod env-value claim is correctly quarantined in gatedChecks (vercel-env, timing, db-rowcount). Evidence entries are all static, verifiable code facts.
- Blast-radius nuance verified: cost-per-hour and idle pages have force-dynamic and call getViewerSteamId exactly once (no duplicate-session waterfall — that is genres-only), getGenreBreakdown is imported only by app/insights/genres/page.tsx plus tests, and steamSpyLimiter is a global singleton. All as the worker stated.
- Baseline genres unit suite is green at HEAD; the defect is isolated to identified code with no fix required to be planning-ready (the SteamSpy gate question is a product/ops decision deferred to gatedChecks).
