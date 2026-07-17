# Theme 2 — Per-game external fan-outs on request paths

**Branch:** `altan/optimization` · **HEAD:** `13023e335764daed73900fabc0d88eab4d190eff` · **Date:** 2026-07-09 · **Phase:** investigation

Read-only root-cause pass over every request-path code site that fans out one Steam
Web API / Store API / SteamSpy call per owned game, serialized by a token-bucket
limiter. Cross-referenced against the settled **bug-3** receipt
(`wayline/evidence/reports/bug-3-insights-slow.md` +
`wayline/evidence/verification/bug-3-insights-slow.evidence.md`) and `docs/ERROR.md`
(ERR-0003, ERR-0010, ERR-0011).

## Assumptions (stated once, used everywhere)

- **N = 65 owned games**, **51 achievement-bearing**. This is the repo's own
  canonical "real library" figure, recorded in `docs/ERROR.md` ERR-0003 (":38 s… 65
  owned games, 51 with achievements"), ERR-0010, and ERR-0011 (64.8 s genres). The
  dev DB is empty (`OwnedGame`=0, `PlaytimeSnapshot`=0 in `prisma/test.db`) and the
  fixture `tests/fixtures/steam/owned-games.json` holds only 2 games, so no live
  row-count is available — all cost is the documented N=65 with explicit math.
- **Limiter floor:** Web API + Store = **1 req / 250 ms** (`REFILL_INTERVAL_MS`,
  `lib/steam/limiter.ts:12,85,94`); SteamSpy = **1 req / 1000 ms**
  (`lib/steam/limiter.ts:101`). These are the *wall*, not the network.

## Verdict summary

| ID | Verdict | One-line |
|---|---|---|
| STEAM-1 | confirmed | `/library?multiplayer=1` fans out 1 Store metadata call/game (N×250 ms ≈ 16 s cold), gated behind the filter param. |
| STEAM-2/DATA-8 | confirmed (mitigated) | Dashboard achievements fan-out is real but already bounded to top-20, short-circuited to 1 call/game, and streamed via Suspense (ERR-0003). |
| STEAM-3/DATA-1/RSC-3 | confirmed (= bug-3) | `/insights/genres` SteamSpy per-game loop at 1 req/s — the exact unfixed remnant bug-3 already settled. |
| STEAM-4 | confirmed | `steamLimiter` is one process-global bucket shared across all users/Web-API endpoints; one fan-out serializes everyone. |
| STEAM-5 | needs-measurement | Retry backoff (250/1000/4000 ms) compounds per-call while holding the limiter, but only on transient failures — real cost is runtime-dependent. |
| STEAM-9 | confirmed (root enabler) | Store data is fetched one appId at a time (no multi-id endpoint); the shape every fan-out above inherits. |

---

## STEAM-1 — `/library` multiplayer filter fans out one Store `appdetails` call per owned game

**Verdict: confirmed.** (Anchor drift: scout cited `multiplayer.ts:47` "called
`app/library/page.tsx:88`" — both are accurate at HEAD.)

**Mechanism.** When `?multiplayer` is truthy, `LibraryPage` calls
`getMultiplayerAppIds(featuredId)` (`app/library/page.tsx:88`). That repo pulls the
profile, then `Promise.all(games.map((g) => getGameStoreMetadata(g.appId)))`
(`server/repositories/multiplayer.ts:47`). `Promise.all` fires all N promises
"concurrently," but each one calls `getStoreMetadata` →
`storeLimiter.acquire()` before its `fetch` (`lib/steam/store-client.ts:8,17`;
`store.ts:23`). The single-token bucket refills once per 250 ms, so the N awaits
drain **serially** at one every 250 ms. The only thing bounding it is the 7-day
metadata TTL (`TTL.storeMetadata`) — once warm it is a set of cache hits; cold (or
post-cold-start with the ephemeral in-process Map cache, per bug-3 staleAnchor #4)
it is the full N×250 ms.

**Cost.** 65 games × 1 call × 250 ms = **~16.3 s cold**, entirely limiter-bound.
Matches ERR-0010's "seconds-to-tens-of-seconds" O(N) Store pattern that was fixed
*for pricing* but **not** for multiplayer categorization. No precompute exists:
unlike genres/price (moved to `Game` columns by the nightly job under ERR-0011),
`categoryIds` are fetched live every time the filter is used.

**Blast radius.** Only `/library?multiplayer=<truthy>` — the default library view is
explicitly guarded (`page.tsx:80-84` "do NOT slow the default library view"), so a
plain `/library` nav pays nothing. Cost is per-filter-activation, cold-cache only,
and does **not** grow with history (bounded by current library size N). One user
toggling the filter serializes 65 Store calls; because it is `storeLimiter` (not the
Web API bucket), it does not starve achievements/profile calls — but it does starve
the nightly library-value Store pass and any concurrent multiplayer filter.

**Cross-refs.** ERR-0010 (same O(N) Store fan-out class, fixed only for pricing);
its "Where else this assumption may be wrong" line explicitly names **multiplayer**
as an unfixed instance. Feeds on STEAM-9 (single-appId Store fetch) and the shared
`storeLimiter`. Sibling of STEAM-3 (same fan-out shape, different upstream).

**Fix direction (one line):** precompute `categoryIds` into a `Game` column in the
nightly job (same pattern ERR-0011 used for genres/price) so the filter reads the DB.

**Evidence**

| File | Line | Quote |
|---|---|---|
| `app/library/page.tsx` | 88 | `const mp = await getMultiplayerAppIds(featuredId).catch(...)` (inside `if (multiplayer)`) |
| `server/repositories/multiplayer.ts` | 47 | `const metadataResults = await Promise.all(games.map((g) => getGameStoreMetadata(g.appId)));` |
| `server/repositories/store.ts` | 22-24 | `cacheKey('store-metadata', 'global', appId)` → `cache(key, TTL.storeMetadata, () => getStoreMetadata(appId))` |
| `lib/steam/store-client.ts` | 8,17 | "Rate-limited with `steamLimiter.acquire()`… `import { storeLimiter }`" (uses `storeLimiter`) |
| `lib/steam/limiter.ts` | 94 | `export const storeLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` |

---

## STEAM-2 / DATA-8 — Dashboard achievement aggregate fans out up-to-3 Web API calls per game

**Verdict: confirmed, but already mitigated (ERR-0003).** The mechanism is real; the
scout's "high impact" framing overstates the *residual* cost because three defenses
already cap it.

**Mechanism.** `AchievementKpiSection` and `AchievementSummarySection` both call
`getAchievementProgress(steamId, appIds)`
(`components/dashboard/AchievementKpiSection.tsx:24`,
`AchievementSummarySection.tsx:26`). That does
`Promise.all(appIds.map((id) => getGameAchievements(steamId, id)))`
(`achievements.ts:111`). Each `getGameAchievements` awaits `getPlayerAchievements`
first (`achievements.ts:55-59`), and **only if available** fires the schema + global
percentage pair in parallel (`achievements.ts:70-77`). Every underlying call does
`steamLimiter.acquire()` (`lib/steam/achievements.ts:207,274,312`) → serialized at
250 ms. So worst case is 3 Web API calls/game, but private/no-achievement games
short-circuit to 1.

**Three bounds already in place** (do not re-litigate — ERR-0003 settled these):
1. `appIds` is capped to the top-20 most-played achievement games —
   `ACHIEVEMENT_SUMMARY_GAME_LIMIT = 20` (`app/page.tsx:85-88`), not the whole 51.
2. Short-circuit to 1 call for unavailable games (`achievements.ts:64-66`).
3. Both dashboard sections stream in their own `<Suspense>` (`app/page.tsx:139,163`),
   and the cache single-flight collapses the two callers into one fan-out
   (`app/page.tsx:129-133`).

**Cost.** Cold-cache upper bound = 20 games × 3 calls × 250 ms = **~15 s**, but
Suspense keeps it off first paint and the 1 h `TTL.playerAchievements` makes warm
loads instant. Private library ≈ 20 × 1 × 250 ms = ~5 s. This is the ~38 s → ~5-12 s
improvement ERR-0003 already recorded. **New/residual finding:** the 250 ms per call
is still *serial across the 20 games* even behind Suspense — it is bounded, not
eliminated; a further win would be precomputing achievement totals nightly (the
Phase-2 direction ERR-0003 itself names).

**Blast radius.** Dashboard (`app/page.tsx`) only, cold-cache, behind Suspense so it
never blocks the shell. Both KPI tile and summary card share the single fan-out.
Consumes the **shared** `steamLimiter` (see STEAM-4) — a cold dashboard render
serializes 20-60 Web API calls that any concurrent request also waiting on
`steamLimiter` queues behind.

**Cross-refs.** ERR-0003 (root ticket — bounded + short-circuit). STEAM-4 (shared
limiter is what makes even this bounded fan-out contend globally). Same "N× a
rate-limited call on first paint" design smell ERR-0003/ERR-0010 flag.

**Fix direction (one line):** precompute per-user achievement totals in the nightly
job → dashboard reads one aggregate row (mirrors the `LibraryValueAggregate` fix).

**Evidence**

| File | Line | Quote |
|---|---|---|
| `server/repositories/achievements.ts` | 111 | `const results = await Promise.all(appIds.map((id) => getGameAchievements(steamId, id)));` |
| `server/repositories/achievements.ts` | 55-59 | `const playerResult = await cache(cacheKey('player-achievements', id, appId), ... )` (fetched FIRST) |
| `server/repositories/achievements.ts` | 64-66 | `if (!playerAvailability.available) { return playerAvailability; }` (short-circuit) |
| `server/repositories/achievements.ts` | 70-77 | `Promise.all([...schema..., ...global...])` (2 more calls only when available) |
| `lib/steam/achievements.ts` | 207,274,312 | `await steamLimiter.acquire();` before each of the 3 endpoint fetches |
| `app/page.tsx` | 85-88 | `const ACHIEVEMENT_SUMMARY_GAME_LIMIT = 20; const achievementAppIds = topGamesByPlaytime(...20)` |
| `app/page.tsx` | 139,163 | `<Suspense fallback={...}><AchievementKpiSection .../>` / `<AchievementSummarySection .../>` |

---

## STEAM-3 / DATA-1 / RSC-3 — `/insights/genres` SteamSpy per-game fan-out at 1 req/s

**Verdict: confirmed. This IS bug-3's dominant conditional cause — fully settled
there; cited, not re-litigated.** (Anchor: scout cited `genres.ts:96`; at HEAD the
`await cache(... getSteamSpyData ...)` is at `genres.ts:96` inside the loop opened at
`:85`. Matches bug-3 receipt exactly.)

**Mechanism.** `getGenreBreakdown` loops every owned game
(`genres.ts:85`) and, **when `env.ENABLE_STEAMSPY`** (`genres.ts:95`), `await`s
`getSteamSpyData(appId)` one game at a time (`genres.ts:96-98`), each blocked on
`steamSpyLimiter.acquire()` at 1 req/s (`lib/steam/steamspy-client.ts:113`;
`limiter.ts:101`). Genres themselves already read from the `Game` table in a single
query (`genres.ts:57-60`) — that half was fixed under ERR-0011. The SteamSpy tag loop
is the **explicitly-deferred remnant** ERR-0011 names ("when enabled it remains a
known render-path fan-out (follow-up: persist tags)").

**Cost.** 65 games × 1 call × 1000 ms = **~65 s cold** with the flag ON — exceeds the
Vercel function timeout (page never renders). ERR-0011 measured 64.8 s. Flag defaults
OFF (`server/env.ts:33-36`) → dormant. This is bug-3's DOMINANT-but-CONDITIONAL cause;
its 5/5 gap is the unread prod value of `ENABLE_STEAMSPY`.

**Blast radius.** `/insights/genres` only (`getGenreBreakdown` is imported solely by
`app/insights/genres/page.tsx`, per bug-3 verification). Cold-cache, flag-gated. Does
**not** grow with history (bounded by N). `steamSpyLimiter` is a global singleton so a
flag-on render starves the nightly SteamSpy enrichment job.

**Cross-refs.** **bug-3 root-cause #1** (dominant conditional) — see
`wayline/evidence/reports/bug-3-insights-slow.md:11-16` and evidence receipt line 17.
ERR-0011 (the ticket that fixed genres/price fan-out but deferred tags). Same fan-out
shape as STEAM-1 (Store) — SteamSpy just at 4× the limiter floor.

**Fix direction (one line):** persist SteamSpy tags into a `Game`/`GameTag` column in
the nightly job so the render reads the DB — exactly bug-3 fix #1.

**Evidence**

| File | Line | Quote |
|---|---|---|
| `server/repositories/insights/genres.ts` | 85 | `for (const game of ownedGames) {` |
| `server/repositories/insights/genres.ts` | 95-98 | `if (env.ENABLE_STEAMSPY) { const spyResult = await cache(cacheKey('steamspy','global',appId), TTL.steamSpy, () => getSteamSpyData(appId)); }` |
| `lib/steam/steamspy-client.ts` | 113 | `await steamSpyLimiter.acquire();` |
| `lib/steam/limiter.ts` | 101 | `export const steamSpyLimiter = new TokenBucketLimiter(1, 1000);` |
| `server/repositories/insights/genres.ts` | 57-60 | `prisma.game.findMany({ where:{ appId:{ in: appIds }}, select:{ appId:true, genres:true }})` (genres already DB-read) |

---

## STEAM-4 — `steamLimiter` is one process-global bucket shared by all users and Web-API endpoints

**Verdict: confirmed.** (Anchor: scout cited `limiter.ts:85`; the export is at
`limiter.ts:85` at HEAD.)

**Mechanism.** `steamLimiter` is a module-level singleton
(`lib/steam/limiter.ts:85`) with capacity 1, refill 250 ms. Every Web API client —
achievements (`lib/steam/achievements.ts:207,274,312`), owned-games, level,
recently-played — calls `steamLimiter.acquire()` before fetching. There is no
per-user or per-request partitioning: the token bucket is global to the Node process.
So any one fan-out (e.g. STEAM-2's 20-60 achievement calls) enqueues its `acquire()`
calls into the same `waiting` array (`limiter.ts:19,37-40`) that every other
concurrent request's Web API call must queue behind. One user's cold dashboard makes
every other in-flight request's Steam call wait its turn at 250 ms increments.

**Cost.** No standalone cost — it is a **multiplier/contention** amplifier on
STEAM-2. Under concurrency C users each triggering a k-call fan-out, total Web-API
drain time ≈ C × k × 250 ms **serialized process-wide**. E.g. 3 users cold-loading
the dashboard simultaneously = 3 × 20 × 250 ms = ~15 s of serialized queue, and a 4th
user's single profile fetch waits behind all of it. The design deliberately separates
`storeLimiter` (`:94`) and `steamSpyLimiter` (`:101`) by host, so the Store multiplier
(STEAM-1) does NOT starve the Web API — the scout's scoping note ("Web API bucket
only; Store bucket is separate by design") is correct.

**Blast radius.** Every route that touches the Steam **Web** API under concurrency:
dashboard achievements, profile/owned-games on `/`, `/library`, `/game/[appId]`,
compare. Worsens as user count / concurrent cold renders rise. Single-process only —
on Vercel each serverless instance has its own bucket, so real blast radius depends on
instance concurrency (multiple users routed to one warm instance).

**Cross-refs.** ERR-0010 fix (3) introduced the `storeLimiter` split precisely to stop
a Store flood starving the Web API — STEAM-4 is the *remaining* single point of
contention on the Web-API side. Amplifies STEAM-2. Independent of history growth.

**Fix direction (one line):** the durable answer is removing the fan-outs (precompute)
so the shared bucket is never saturated; per-user fairness queuing is a lesser
mitigation.

**Evidence**

| File | Line | Quote |
|---|---|---|
| `lib/steam/limiter.ts` | 85 | `export const steamLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` |
| `lib/steam/limiter.ts` | 19,37-40 | `private readonly waiting: Array<() => void> = [];` … `this.waiting.push(resolve); this.ensureRefillScheduled();` (single shared queue) |
| `lib/steam/limiter.ts` | 94,101 | separate `storeLimiter` / `steamSpyLimiter` — Web API bucket is isolated from those two hosts |
| `lib/steam/achievements.ts` | 207,274,312 | all three achievement endpoints share `steamLimiter.acquire()` |

---

## STEAM-5 — Retry backoff (250/1000/4000 ms) layered on top of fan-outs

**Verdict: needs-measurement.** Code mechanism confirmed; real-world cost depends on
the transient-failure rate at runtime, which is not observable from source.

**Mechanism.** `withRetry` does 1 attempt + up to 3 retries with backoff
`[250, 1000, 4000]` ms (`lib/steam/retry.ts:5-6`), sleeping between attempts
(`retry.ts:49-50`). Critically, the `steamLimiter.acquire()` happens **outside**
`withRetry` in the Web API clients (`lib/steam/achievements.ts:207` acquire, then
`:211` `withRetry(...)`), so a retrying call does **not** re-acquire a token per
attempt — but it **does** hold up wall-clock time on the fan-out: a single game that
exhausts retries adds 250+1000+4000 = **5.25 s** of `sleep` before its slot completes,
and because `getAchievementProgress`/genres await results in a `Promise.all` or serial
loop, that 5.25 s extends the whole aggregate's completion. Note: Store
(`store-client.ts:9` "Single attempt — no withRetry") and SteamSpy
(`steamspy-client.ts:10`) do **not** retry, so STEAM-5 only compounds the **Web-API**
fan-out (STEAM-2), not STEAM-1/STEAM-3.

**Cost.** Per fully-failing call: +5.25 s. If f of 20 achievement games hit terminal
transient failures, added latency ≈ f × 5.25 s (they run concurrently within the
`Promise.all`, so it is the max path, roughly one 5.25 s tail if failures overlap;
worst case if they interleave with limiter queuing, additive). **What would close it:**
production transient-error rate for the Web API endpoints (Vercel logs / a counter on
`withRetry` exhaustion). At f≈0 this is negligible; the mechanism only bites during a
Steam degradation window.

**Blast radius.** Web API fan-out paths under transient Steam failures only —
dashboard achievements. Not history-growing; episodic (correlated with Steam
outages). Amplifies STEAM-2 during incidents.

**Cross-refs.** Compounds STEAM-2 / STEAM-4. Orthogonal to STEAM-1/STEAM-3 (no retry
there). No existing ERR entry.

**Fix direction (one line):** cap total retry budget per aggregate (or fail-fast the
fan-out once one call is retrying) so a Steam blip can't multiply across 20 games —
but low priority until measured.

**Evidence**

| File | Line | Quote |
|---|---|---|
| `lib/steam/retry.ts` | 5-6 | `const DEFAULT_ATTEMPTS = 4; const DEFAULT_BACKOFF_MS = [250, 1000, 4000] as const;` |
| `lib/steam/retry.ts` | 46-50 | `if (isLastAttempt) break; const delayMs = backoff[attempt] ...; await sleep(delayMs);` |
| `lib/steam/achievements.ts` | 207,211 | `await steamLimiter.acquire();` then `raw = await withRetry(() => fetchJson(url));` (acquire outside retry) |
| `lib/steam/store-client.ts` | 9 | "Single attempt — Store API is best-effort; no withRetry." (STEAM-1 not affected) |
| `lib/steam/steamspy-client.ts` | 10 | "Single attempt — best-effort; no withRetry." (STEAM-3 not affected) |

---

## STEAM-9 — Store metadata/price fetched one appId at a time (no multi-id endpoint)

**Verdict: confirmed (root enabler, not an independent hotspot).** (Anchor: scout
cited `store.ts:34`; at HEAD `getGameStorePrice` is at `store.ts:32` and
`getGameStoreMetadata` at `:21` — minor drift, both single-appId.)

**Mechanism.** `getGameStoreMetadata(appId)` and `getGameStorePrice(appId)` each key
their cache and fetch by a **single** appId (`store.ts:22-24, 33-35`) →
`getStoreMetadata`/`getStorePrice` in `store-client.ts`, one `storeLimiter.acquire()`
per call. Steam's Store `appdetails` endpoint has no reliable multi-id batch form, so
there is no way to collapse N games into one request — every consumer that needs
library-wide Store data must issue N single-appId calls. This is the **primitive** on
which STEAM-1 (multiplayer categories) and the nightly library-value pass are built;
it is *why* those fan-outs are O(N)×limiter rather than O(1).

**Cost.** No cost in isolation — a single cached call is cheap (7-day metadata / 1-h
price TTL). Its significance is structural: it forces the N×250 ms shape onto
STEAM-1 and any future per-game Store aggregate. The correct mitigation everywhere is
**not** batching (impossible) but **precompute + read-aggregate** — which is exactly
what ERR-0010 (price → `LibraryValueAggregate`) and ERR-0011 (genres/price → `Game`
columns) already did for the pricing/genre paths.

**Blast radius.** Every Store consumer: STEAM-1 (`multiplayer.ts`), `library-value.ts`
(nightly job, already off request path per ERR-0010), `game-store.ts` /
`GameStoreSection.tsx` (single-game detail page — N=1, fine), `/game/[appId]`
(single, fine). The only *request-path* O(N) instance left is STEAM-1.

**Cross-refs.** Enables STEAM-1. Analogue for the Web API is the per-game achievement
call (STEAM-2). ERR-0010 / ERR-0011 are the precompute fixes that neutralize this
primitive on the paths they cover; multiplayer is the one they didn't.

**Fix direction (one line):** accept single-appId fetching as unavoidable, and
neutralize it the proven way — persist the needed Store field into a `Game` column in
the nightly job so no request path loops it.

**Evidence**

| File | Line | Quote |
|---|---|---|
| `server/repositories/store.ts` | 21-24 | `getGameStoreMetadata(appId: number)` → `cache(cacheKey('store-metadata','global',appId), TTL.storeMetadata, () => getStoreMetadata(appId))` |
| `server/repositories/store.ts` | 32-35 | `getGameStorePrice(appId: number)` → `cache(cacheKey('store-price','global',appId), TTL.storePrice, () => getStorePrice(appId))` |
| `server/repositories/library-value.ts` | 62-65,80 | "O(N) rate-limited Store calls… Runs OFF the request path (nightly snapshot job)" — `Promise.all(games.map((g) => getGameStorePrice(g.appId)))` (already precomputed per ERR-0010) |

---

## Theme-level ranking — which fan-outs dominate

1. **STEAM-3 (bug-3) — dominant WHEN `ENABLE_STEAMSPY=1`.** 65 × 1 s = ~65 s, exceeds
   function timeout. Already fully root-caused and fix-specified in bug-3; the only
   open item is the prod flag value (a 30-second Vercel check). Nothing to add.
2. **STEAM-1 — the highest-value NEW request-path fan-out.** ~16 s cold on
   `/library?multiplayer=1`, flag-independent, no precompute exists. ERR-0010's own
   "where else" note predicted it; it was never closed. This is the finding this theme
   contributes that bug-3 does **not** cover.
3. **STEAM-4 — the contention multiplier.** Turns every bounded Web-API fan-out into a
   process-wide queue under concurrency. Not a standalone latency but the reason
   STEAM-2 hurts neighbours. Durable fix = remove the fan-outs.
4. **STEAM-2 — real but already mitigated** (bounded-20 + short-circuit + Suspense,
   ERR-0003). Residual ~15 s cold sits behind Suspense; a nightly precompute would
   finish the job.
5. **STEAM-9 — structural enabler**, not a hotspot; the fix is precompute, already
   proven twice in this codebase.
6. **STEAM-5 — needs-measurement**, episodic, only compounds the Web-API path during
   Steam outages.

**One common cure across STEAM-1/2/3/9:** the repo has a settled, twice-shipped
pattern (ERR-0010 `LibraryValueAggregate`, ERR-0011 `Game.genres`/`priceFinalCents`) —
persist the per-game field in the nightly job, read an aggregate on render, zero
request-path fan-out. STEAM-1 (multiplayer `categoryIds`) and STEAM-2 (achievement
totals) are the two request-path fan-outs that still lack that treatment; STEAM-3's
SteamSpy tags is the flag-gated third (bug-3 fix #1).

## Open questions

- **`ENABLE_STEAMSPY` prod value** — inherited from bug-3's 5/5 gap; gates whether
  STEAM-3 is live. Read Vercel env (read-only, not run here).
- **Real N and snapshot growth** — dev DB empty, fixture N=2; all costs use the
  documented N=65. A live `SELECT COUNT(*) FROM OwnedGame GROUP BY steamId` would
  confirm the multiplier for STEAM-1/STEAM-2.
- **Web-API transient-failure rate** — closes STEAM-5; needs a `withRetry`-exhaustion
  counter or Vercel error logs.
- **Instance concurrency on Vercel** — determines STEAM-4's real blast radius (how
  many users share one process's `steamLimiter`).
