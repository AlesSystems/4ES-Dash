# Evidence — Theme 2: Per-game external fan-outs on request paths (adversarial verification)

> Read-only adversarial verification of the scout report
> `wayline/optimization/investigation/theme-2-external-fanouts.md`.
>
> **Branch:** `altan/optimization` · **HEAD:** `13023e335764daed73900fabc0d88eab4d190eff` · **Date:** 2026-07-09 · **Phase:** verification
>
> **Reviewer:** adversarial optimization reviewer (separate context from scout).
> **Method:** every cited file opened this run at HEAD; every cost constant re-read
> from source (`lib/steam/limiter.ts`, `lib/steam/retry.ts`); every blast-radius claim
> re-grepped for import sites. Cross-checked against
> `wayline/evidence/verification/bug-3-insights-slow.evidence.md` and `docs/ERROR.md`.

## Reviewer verdict summary

| ID | Scout verdict | Reviewer verdict | One-line |
|---|---|---|---|
| STEAM-1 | confirmed | **CONFIRMED** | `/library?multiplayer` fans out 1 live Store `appdetails` call/game; no `Game.categoryIds` precompute exists; ~16.3s cold. |
| STEAM-2/DATA-8 | confirmed (mitigated) | **CONFIRMED** | Dashboard achievements fan out ≤3 Web-API calls/game, but bounded top-20 + short-circuit + Suspense + single-flight all verified. ~15s cold upper bound, off first paint. |
| STEAM-3/DATA-1/RSC-3 | confirmed (= bug-3) | **CONFIRMED** | `/insights/genres` SteamSpy per-game loop at 1 req/s; the exact flag-gated bug-3 remnant. ~65s cold when `ENABLE_STEAMSPY=1`; flag defaults OFF. |
| STEAM-4 | confirmed | **CONFIRMED** | `steamLimiter` is one process-global capacity-1 bucket shared by all Web-API endpoints; single shared `waiting` queue. Contention multiplier, per-instance. |
| STEAM-5 | needs-measurement | **PLAUSIBLE** | Retry schedule `[250,1000,4000]`=5.25s/failing-call verified; `acquire` is outside `withRetry`; magnitude gated on prod transient-failure rate. |
| STEAM-9 | confirmed (root enabler) | **CONFIRMED** | Store metadata/price fetched one appId at a time; structural O(N) primitive; zero cost in isolation. |

**Bottom line:** the scout report is accurate. All six mechanisms reproduce from source
at HEAD, every rate/retry constant matches, and no mitigating mechanism was missed —
the scout in fact *credited* every mitigation (top-20 bound, short-circuit, Suspense,
single-flight, limiter host-split, precompute-elsewhere). Five findings CONFIRMED; STEAM-5
correctly self-demoted to needs-measurement (mapped to PLAUSIBLE, one gated check). Only
minor line-anchor drift, itemized below.

---

## STEAM-1 — `/library` multiplayer filter fans out one live Store `appdetails` call per owned game — **CONFIRMED**

Mechanism reproduced end to end. `LibraryPage` only calls the repo inside `if (multiplayer)`
(`app/library/page.tsx:84,88`). `getMultiplayerAppIds` pulls the full profile
(`multiplayer.ts:45`) then `Promise.all(games.map((g) => getGameStoreMetadata(g.appId)))`
(`multiplayer.ts:47`). Each `getGameStoreMetadata` → `cache(...)` → `getStoreMetadata(appId)`
(`store.ts:21-24`) → `fetchEntry` which does `await storeLimiter.acquire()` before a single-appId
`fetch` (`store-client.ts:150`). `storeLimiter` is capacity 1 / 250 ms (`limiter.ts:94`), so the
`Promise.all` fires all N `acquire()` calls but they drain serially at one per 250 ms.

**Cost math checks out:** 65 × 250 ms = 16.25 s ≈ **~16.3 s cold**, entirely limiter-bound.
Warm = cache hits (7-day `TTL.storeMetadata`); cold or post-cold-start (ephemeral in-process
Map, no Redis — bug-3 staleAnchor #4) pays the full N.

**No precompute exists — independently verified.** `prisma/schema.prisma` `model Game` has
`genres` (:55), `priceFinalCents`/`priceCurrency` (:64-65) written nightly, but **no
`categoryIds`/`categories` column**. `grep -rn categoryIds` finds it only on the live
`StoreMetadata` type and the multiplayer classifier — never persisted. So the multiplayer filter
truly re-fetches live every activation, unlike genres/price (ERR-0011). Scout claim exact.

**Blast radius correct:** default `/library` is guarded ("do NOT slow the default library view",
`page.tsx:80-81`); grep confirms `getMultiplayerAppIds` has exactly one caller
(`app/library/page.tsx:88`). Uses `storeLimiter`, not `steamLimiter`, so it does not starve Web-API
calls — but does contend with the nightly library-value Store pass and any concurrent multiplayer
filter. All as stated.

**Fix direction (one line):** persist `categoryIds` into a `Game` column in the nightly job (same
pattern ERR-0011 used for genres/price); the filter then reads the DB.

**Evidence**

| File | Line | Finding |
|---|---|---|
| `app/library/page.tsx` | 84 | `if (multiplayer) {` — fan-out is gated on the filter param |
| `app/library/page.tsx` | 88 | `const mp = await getMultiplayerAppIds(featuredId).catch(...)` |
| `server/repositories/multiplayer.ts` | 47 | `const metadataResults = await Promise.all(games.map((g) => getGameStoreMetadata(g.appId)));` |
| `server/repositories/store.ts` | 21-24 | `getGameStoreMetadata(appId)` → `cache(cacheKey('store-metadata','global',appId), TTL.storeMetadata, () => getStoreMetadata(appId))` |
| `lib/steam/store-client.ts` | 150 | `await storeLimiter.acquire();` inside `fetchEntry` (single appId per call) |
| `lib/steam/limiter.ts` | 94 | `export const storeLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` (REFILL=250, :12) |
| `prisma/schema.prisma` | 49-67 | `model Game` has `genres`,`priceFinalCents`,`priceCurrency` but NO `categoryIds` — confirms no precompute |

---

## STEAM-2 / DATA-8 — Dashboard achievement aggregate fans out up-to-3 Web-API calls per game — **CONFIRMED (mitigated, as scout stated)**

Mechanism reproduced. `AchievementKpiSection` (`.tsx:24`) and `AchievementSummarySection`
(`.tsx:26`) both call `getAchievementProgress(steamId, appIds)`, which does
`Promise.all(appIds.map((id) => getGameAchievements(steamId, id)))` (`achievements.ts:111`). Each
`getGameAchievements` awaits `getPlayerAchievements` FIRST (`achievements.ts:55-59`); if
unavailable it returns immediately (`:64-66`), else fires schema+global in parallel (`:70-77`).
Each underlying Web-API call does `await steamLimiter.acquire()` (`lib/steam/achievements.ts:207,
274,312`) → 250 ms serialized. Worst case 3 calls/game; private/no-achievement → 1.

**All three claimed mitigations verified present:**
1. Top-20 bound: `const ACHIEVEMENT_SUMMARY_GAME_LIMIT = 20` over `games.filter(g => g.hasAchievements)`
   (`app/page.tsx:85-89`) — not the whole 51.
2. Short-circuit to 1 call: `if (!playerAvailability.available) { return playerAvailability; }`
   (`achievements.ts:64-66`).
3. Suspense: `<Suspense fallback={<AchievementKpiSkeleton/>}>` (`app/page.tsx:139`) and
   `<Suspense fallback={<AchievementSummarySkeleton/>}>` (`app/page.tsx:162-163`), so it never
   blocks first paint.
4. **Single-flight verified independently** (`server/cache.ts:34-36,93-107`): `inFlight` map
   collapses concurrent misses on the same key onto one loader, so the two Suspense sections sharing
   the same `appIds` do not double the Steam fan-out — either they overlap (join `inFlight`) or the
   second reads the store the first populated. Scout claim exact.

**Cost math checks out:** cold upper bound 20 × 3 × 250 ms = **~15 s**; private ≈ 20 × 1 × 250 ms =
~5 s. Behind Suspense; warm instant via 1 h `TTL.playerAchievements`. Residual = the 250 ms/call is
still serial across the 20 games even behind Suspense — bounded, not eliminated. Matches ERR-0003's
recorded ~38 s → ~5–13 s.

**Fix direction (one line):** precompute per-user achievement totals nightly → dashboard reads one
aggregate row (mirrors `LibraryValueAggregate`).

**Evidence**

| File | Line | Finding |
|---|---|---|
| `components/dashboard/AchievementKpiSection.tsx` | 24 | `const result = await getAchievementProgress(steamId, appIds);` |
| `components/dashboard/AchievementSummarySection.tsx` | 26 | `const result = await getAchievementProgress(steamId, appIds);` |
| `server/repositories/achievements.ts` | 111 | `const results = await Promise.all(appIds.map((id) => getGameAchievements(steamId, id)));` |
| `server/repositories/achievements.ts` | 55-59 | player-achievements `cache(...)` fetched FIRST |
| `server/repositories/achievements.ts` | 64-66 | `if (!playerAvailability.available) { return playerAvailability; }` (short-circuit to 1 call) |
| `server/repositories/achievements.ts` | 70-77 | `Promise.all([...schema..., ...global...])` — 2 more calls only when available |
| `lib/steam/achievements.ts` | 207,274,312 | `await steamLimiter.acquire();` before each of the 3 endpoint fetches |
| `app/page.tsx` | 85-89 | `ACHIEVEMENT_SUMMARY_GAME_LIMIT = 20` over `games.filter(g => g.hasAchievements)` |
| `app/page.tsx` | 139,162-163 | both sections in their own `<Suspense>` |
| `server/cache.ts` | 34-36,93-107 | `inFlight` single-flight map collapses concurrent same-key misses |

---

## STEAM-3 / DATA-1 / RSC-3 — `/insights/genres` SteamSpy per-game fan-out at 1 req/s — **CONFIRMED (= bug-3 remnant, cited not re-litigated)**

Mechanism reproduced and matches the settled bug-3 receipt. `getGenreBreakdown` loops every owned
game (`genres.ts:85`) and, when `env.ENABLE_STEAMSPY` (`genres.ts:95`), `await`s
`cache(cacheKey('steamspy','global',appId), TTL.steamSpy, () => getSteamSpyData(appId))` one game at
a time (`genres.ts:96-98`). `getSteamSpyData` does `await steamSpyLimiter.acquire()`
(`steamspy-client.ts:113`); `steamSpyLimiter = new TokenBucketLimiter(1, 1000)` (`limiter.ts:101`) —
1 req/s. Genres themselves already read from `Game` in a single query (`genres.ts:57-60`) — the
ERR-0011 half that was fixed.

**Cost math checks out:** 65 × 1000 ms = **~65 s cold** with the flag ON — exceeds Vercel timeout;
ERR-0011 measured 64.8 s. Flag defaults OFF: `ENABLE_STEAMSPY` is
`.enum([...]).optional().transform(v => v === '1' || v === 'true')` (`server/env.ts:33-36`), so an
unset var is falsy → dormant.

**Blast radius correct:** grep confirms `getGenreBreakdown` has exactly one caller
(`app/insights/genres/page.tsx:41`). `steamSpyLimiter` is a global singleton, so a flag-on render
starves the nightly SteamSpy enrichment job. All as stated and consistent with the bug-3 receipt
(lines 17-19, 45, 47).

**Fix direction (one line):** persist SteamSpy tags into a `Game`/`GameTag` column in the nightly
job (bug-3 fix #1).

**Evidence**

| File | Line | Finding |
|---|---|---|
| `server/repositories/insights/genres.ts` | 85 | `for (const game of ownedGames) {` |
| `server/repositories/insights/genres.ts` | 95 | `if (env.ENABLE_STEAMSPY) {` |
| `server/repositories/insights/genres.ts` | 96-98 | `const spyResult = await cache(cacheKey('steamspy','global',appId), TTL.steamSpy, () => getSteamSpyData(appId));` (serial await in loop) |
| `server/repositories/insights/genres.ts` | 57-60 | `prisma.game.findMany({ where:{appId:{in:appIds}}, select:{appId,genres} })` — genres already DB-read |
| `lib/steam/steamspy-client.ts` | 113 | `await steamSpyLimiter.acquire();` |
| `lib/steam/limiter.ts` | 101 | `export const steamSpyLimiter = new TokenBucketLimiter(1, 1000);` |
| `server/env.ts` | 33-36 | `ENABLE_STEAMSPY` transform — unset ⇒ falsy (default OFF) |

---

## STEAM-4 — `steamLimiter` is one process-global bucket shared by all Web-API endpoints — **CONFIRMED**

Reproduced. `export const steamLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS)`
(`limiter.ts:85`), capacity 1, refill 250 ms (`:12,23-27`). The bucket holds a single shared
`waiting: Array<() => void>` queue (`:19`); `acquire` pushes the resolver and schedules one refill
(`:37-41`); `drain` releases in FIFO order (`:68-81`). No per-user/per-request partitioning — it is a
module-level singleton. Every Web-API endpoint (all three achievement calls at
`lib/steam/achievements.ts:207,274,312`, plus owned-games/level/recently-played via the shared
`lib/steam/client.ts` pattern) enqueues into the same queue. So one fan-out serializes every other
concurrent Web-API `acquire()` process-wide.

**Cost framing correct:** no standalone latency — a contention multiplier. Under C concurrent users
each triggering a k-call fan-out, total Web-API drain ≈ C × k × 250 ms serialized. The scout's
scoping note is verified: `storeLimiter` (`:94`) and `steamSpyLimiter` (`:101`) are separate buckets
by host, so a Store flood (STEAM-1) does NOT starve the Web API. Scout also correctly notes Vercel
gives each serverless instance its own bucket, so real blast radius depends on instance concurrency.

**Fix direction (one line):** remove the fan-outs (precompute) so the shared bucket is never
saturated; per-user fairness queuing is a lesser mitigation.

**Evidence**

| File | Line | Finding |
|---|---|---|
| `lib/steam/limiter.ts` | 85 | `export const steamLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` |
| `lib/steam/limiter.ts` | 19 | `private readonly waiting: Array<() => void> = [];` (single shared queue) |
| `lib/steam/limiter.ts` | 37-41 | `this.waiting.push(resolve); this.ensureRefillScheduled();` |
| `lib/steam/limiter.ts` | 68-81 | `drain()` FIFO release + reschedule while callers wait |
| `lib/steam/limiter.ts` | 94,101 | separate `storeLimiter` / `steamSpyLimiter` — Web-API bucket isolated from those hosts |
| `lib/steam/achievements.ts` | 207,274,312 | all three achievement endpoints share `steamLimiter.acquire()` |

---

## STEAM-5 — Retry backoff `[250,1000,4000]` layered on the Web-API fan-out — **PLAUSIBLE (needs-measurement)**

Code mechanism fully verified; magnitude is runtime-gated. `withRetry` runs 1 attempt + up to 3
retries (`DEFAULT_ATTEMPTS = 4`, `DEFAULT_BACKOFF_MS = [250, 1000, 4000]`, `retry.ts:5-6`), sleeping
`backoff[attempt]` between attempts (`retry.ts:46-50`). A call that exhausts all retries sleeps
250+1000+4000 = **5.25 s** before failing. Critically, `steamLimiter.acquire()` is **outside**
`withRetry` (`lib/steam/achievements.ts:207` acquire, then `:211` `withRetry(() => fetchJson(url))`),
so a retrying call does NOT re-acquire a token per attempt — it holds only wall-clock, not extra
tokens. Confirmed the retry is Web-API-only: `store-client.ts:9` ("Single attempt … no withRetry")
and `steamspy-client.ts:10` ("Single attempt — best-effort; no withRetry") — so STEAM-5 compounds
only STEAM-2, never STEAM-1/STEAM-3.

Only retryable errors incur the delay: `SteamApiError({kind:'transient'})` (5xx / network) and raw
non-Steam errors; `auth|private|rate_limit|schema` bubble immediately (`retry.ts:38-43`). So the cost
is +5.25 s per *terminally-failing transient* call. At f≈0 this is negligible; it only bites during a
Steam degradation window. That rate is not observable from source — hence PLAUSIBLE, not CONFIRMED.

**Fix direction (one line):** cap total retry budget per aggregate (or fail-fast the fan-out once one
call is retrying) so a Steam blip can't multiply across 20 games — low priority until measured.

### Gated checks — human live lane (read-only; never run inside this verification)

#### `web-api-transient-rate`
```
Read Vercel function logs for /  (dashboard) over a representative window, OR add a
counter that increments when withRetry (lib/steam/retry.ts:59) throws after exhausting
attempts, per endpoint.
```
**Expect:** If the per-call terminal-transient-failure rate f is ~0 in steady state, STEAM-5 adds
negligible latency and stays a non-issue. If f is materially > 0 (e.g. during a Steam ISteamUserStats
degradation), added dashboard latency ≈ (number of failing calls of the ≤60) × 5.25 s, concentrated on
the fan-out tail. This single runtime number settles CONFIRMED-vs-negligible; nothing in source can
substitute for it.

**Evidence**

| File | Line | Finding |
|---|---|---|
| `lib/steam/retry.ts` | 5-6 | `const DEFAULT_ATTEMPTS = 4; const DEFAULT_BACKOFF_MS = [250, 1000, 4000] as const;` |
| `lib/steam/retry.ts` | 46-50 | `if (isLastAttempt) break; const delayMs = backoff[attempt] ...; await sleep(delayMs);` |
| `lib/steam/retry.ts` | 38-43 | non-`transient` Steam errors bubble immediately (no retry delay) |
| `lib/steam/achievements.ts` | 207,211 | `await steamLimiter.acquire();` then `withRetry(() => fetchJson(url))` — acquire OUTSIDE retry |
| `lib/steam/store-client.ts` | 9 | "Single attempt — Store API is best-effort; no withRetry." (STEAM-1 unaffected) |
| `lib/steam/steamspy-client.ts` | 10 | "Single attempt — best-effort; no withRetry." (STEAM-3 unaffected) |

---

## STEAM-9 — Store metadata/price fetched one appId at a time (no multi-id endpoint) — **CONFIRMED (root enabler, not a hotspot)**

Reproduced. `getGameStoreMetadata(appId)` (`store.ts:21-24`) and `getGameStorePrice(appId)`
(`store.ts:32-35`) each key their cache and fetch by a **single** appId → `getStoreMetadata`/
`getStorePrice` → `fetchEntry(appId, ...)` which builds `appids=${appId}` (`store-client.ts:147`) and
one `storeLimiter.acquire()` per call (`:150`). Steam's `appdetails` has no reliable multi-id batch
form, so any library-wide Store need must issue N single-appId calls. This is the primitive under
STEAM-1 and the nightly library-value pass.

**Cost framing correct:** zero in isolation (single cached call; 7-day metadata / 1-h price TTL). The
significance is structural — it forces the O(N)×250 ms shape. The proven neutralizer is precompute +
read-aggregate, exactly what `library-value.ts` already does off the request path: the O(N)
`Promise.all(games.map(g => getGameStorePrice(g.appId)))` lives in `refreshLibraryValueAggregate`
(`library-value.ts:80`), called only by the nightly job (`server/jobs/snapshot.ts:160`), while the
dashboard reads one indexed row via `getLibraryValue` (`library-value.ts:44-60`). ERR-0010/ERR-0011
did this for price/genres; multiplayer `categoryIds` (STEAM-1) is the one request-path instance still
un-precomputed.

**Fix direction (one line):** accept single-appId fetching as unavoidable; neutralize it the proven
way — persist the needed Store field into a `Game` column in the nightly job.

**Evidence**

| File | Line | Finding |
|---|---|---|
| `server/repositories/store.ts` | 21-24 | `getGameStoreMetadata(appId)` — single-appId cache+fetch |
| `server/repositories/store.ts` | 32-35 | `getGameStorePrice(appId)` — single-appId cache+fetch |
| `lib/steam/store-client.ts` | 147,150 | `appids=${appId}` in URL; `await storeLimiter.acquire()` — one call per appId |
| `server/repositories/library-value.ts` | 74-80 | `refreshLibraryValueAggregate` does `Promise.all(games.map(g => getGameStorePrice(g.appId)))` |
| `server/repositories/library-value.ts` | 44-60 | `getLibraryValue` reads one `libraryValueAggregate` row — zero request-path fan-out |
| `server/jobs/snapshot.ts` | 160 | `await refreshLibraryValueAggregate(resolvedSteamId, games);` — off request path (nightly) |

---

## Stale anchors (scout-claimed vs actual at HEAD)

| ID | File | Claimed | Actual | Note |
|---|---|---|---|---|
| STEAM-1 | `lib/steam/store-client.ts` | 8,17 | acquire at **150**; import at 17 | Scout quoted the line-8 doc comment which itself wrongly reads "Rate-limited with `steamLimiter.acquire()`" — the SOURCE COMMENT is stale (code uses `storeLimiter`, import :17, acquire :150). Scout flagged "(uses storeLimiter)". Behaviour claim correct; underlying comment is a pre-existing source doc bug. |
| STEAM-2 | `app/page.tsx` | 139,163 (Suspense) | 139 (Kpi); Suspense **162**, component 163 (Summary) | Trivial: SummarySection `<Suspense>` opens at 162, component at 163. Both present. |
| STEAM-2 | `app/page.tsx` | 85-88 (limit) | 85-**89** | Range extends one line (`.map((g)=>g.appId)` on :89). Content exact. |
| STEAM-4 | `lib/steam/limiter.ts` | 19,37-40 | 19; push at 38; `drain` at 68-81 | `waiting` decl :19 correct; `push(resolve)` at :38 (scout said 37-40 — the `acquire` body spans 37-41). FIFO `drain` at :68-81 (not cited). Mechanism exact. |
| STEAM-9 | `server/repositories/store.ts` | scout's field table cited 34 for price | `getGameStorePrice` at **32** | Scout's own STEAM-9 section acknowledges this drift ("at HEAD … `store.ts:32`"). Minor; content exact. |
| STEAM-3 | `server/repositories/insights/genres.ts` | 96 (await) | await spans **96-98** | The `await cache(...)` statement wraps 96-98; the `if (env.ENABLE_STEAMSPY)` guard is :95. Matches bug-3 receipt (await at :96). |

No anchor drift changes any verdict. All are ≤ a few lines or the scout already noted them.

## Blast-radius corrections

None. Every blast-radius claim independently re-grepped and confirmed:
- `getMultiplayerAppIds` — 1 caller (`app/library/page.tsx:88`), filter-gated. ✓
- `getAchievementProgress` — 2 callers, both dashboard Suspense sections sharing one single-flighted
  fan-out (`AchievementKpiSection.tsx:24`, `AchievementSummarySection.tsx:26`). ✓
- `getGenreBreakdown` — 1 caller (`app/insights/genres/page.tsx:41`); consistent with bug-3 receipt. ✓
- `refreshLibraryValueAggregate` — request path reads only (`getLibraryValue`); the O(N) Store pass is
  nightly-only (`server/jobs/snapshot.ts:160`). ✓
- Limiter host-split (`steamLimiter` vs `storeLimiter` vs `steamSpyLimiter`) confirmed, so STEAM-1's
  Store multiplier does not starve the Web API. ✓

## Scout errors / overstatements found (even on CONFIRMED findings)

- **None material.** The scout was, if anything, conservative: it credited every mitigation
  (top-20 bound, short-circuit, Suspense, single-flight, limiter host-isolation, precompute-elsewhere)
  rather than inflating cost. The only inaccuracy is inherited: the scout's STEAM-1 evidence quote
  reproduces the *source's own* stale comment (`store-client.ts:8` says "steamLimiter" where the code
  uses `storeLimiter`); the scout correctly annotated the true behaviour, so no finding is affected.
- **Cross-check with docs/ERROR.md / bug-3 receipt:** STEAM-3 is the same flag-gated SteamSpy remnant
  the bug-3 receipt adjudicated (evidence rows 17-19, blast-radius line 45,47) and ERR-0011 deferred;
  the scout correctly cites rather than re-litigates it. Consistent.
</content>
</invoke>
