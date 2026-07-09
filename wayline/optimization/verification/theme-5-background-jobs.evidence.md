# Evidence — Theme 5 (Background jobs): serial achievement fan-out, onboarding backfill, and the nightly store double-pass

> Read-only **adversarial** verification of the Theme-5 scout report
> (`wayline/optimization/investigation/theme-5-background-jobs.md`).
>
> **Branch:** `altan/optimization` · **HEAD:** `13023e335764daed73900fabc0d88eab4d190eff` · **Date:** 2026-07-09
> **Reviewer method:** every cited file opened THIS run; token-bucket / retry / cache constants read from source; callers grepped.
>
> **Reviewer verdict summary:**
> - **STEAM-7 / COMP-6** — **PLAUSIBLE.** Mechanism (unbounded serial achievement fan-out on the shared `steamLimiter`) is CONFIRMED verbatim. Absolute wall-clock / truncation is gated on `M` (achievement-game count) and the deployed platform timeout tier — exactly as the scout self-labelled "needs-measurement".
> - **STEAM-8 / COMP-5** — **CONFIRMED (structural).** 3N serial DB writes in one `$transaction` + trailing unbounded `recordAchievementUnlocks`, and it demonstrably lands on a request path (`app/onboarding/page.tsx:50`). Absolute seconds gated on `M`/`N`. Two blast-radius corrections below (Suspense streaming; the resync path is BOUNDED, not unbounded).
> - **STEAM-6** — **PLAUSIBLE.** Mechanism (2N sequential `storeLimiter` acquisitions, run after the achievement work in one invocation) is CONFIRMED. Absolute wall-clock gated on `N` and platform tier.
>
> No claim REFUTED. Scout math is sound on the happy path; the only over-statement is a blast-radius line about the resync path (corrected below).

---

## Shared-context verification (opened this run)

| File | Line | Finding |
|------|------|---------|
| `vercel.json` | 3-8 | Sole cron: `{ "path": "/api/cron/snapshot", "schedule": "0 3 * * *" }`. Confirmed single entry. |
| `app/api/cron/snapshot/route.ts` | 24 | Only `export const dynamic = 'force-dynamic'`. **No `maxDuration`, no `runtime`** on the cron route — confirmed. Job wall-clock is uncapped in code, hard-capped by the platform default. |
| `lib/steam/limiter.ts` | 12 | `const REFILL_INTERVAL_MS = 250;` — the 250 ms floor is real. |
| `lib/steam/limiter.ts` | 85 | `export const steamLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` — capacity 1, 250 ms refill. |
| `lib/steam/limiter.ts` | 94 | `export const storeLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` — **separate bucket** (comment :87-94 confirms the #85 split so store floods never starve the Web-API bucket). |
| `lib/steam/limiter.ts` | 34-64 | Token bucket: first token consumed immediately (`tryConsume`), then one refill per 250 ms via `setTimeout`. A serial loop of K acquires costs `(K-1)×250 ms` (first is free) — the scout's `K×250 ms` over-counts by one interval (~250 ms), immaterial at scale. |
| `lib/steam/retry.ts` | 5-6 | `DEFAULT_ATTEMPTS = 4`, `DEFAULT_BACKOFF_MS = [250, 1000, 4000]`. Retry adds cost ONLY on transient failures; the scout's happy-path math (no retry) is the correct floor. Store client uses **no** `withRetry` (`store-client.ts:9`), so store passes have zero retry cost. |
| `server/cache.ts` | 32 | `const store = new Map<string, Entry<unknown>>()` — pure in-process Map, ephemeral across serverless invocations. Confirms the scout's "always cold at 03:00" regardless of `TTL.playerAchievements = 3600 s`. |
| `server/cache.ts` | 36, 93-107 | Single-flight dedupe exists — but only collapses **concurrent misses on the same key**. The job loops are serial over **distinct appIds**, so single-flight yields **zero** reduction here. Warm-across-passes benefit comes from the plain Map, which the scout used correctly. |
| `server/cache.ts` | 29 | `MAX_ENTRIES = 500` LRU cap. At `M≈100` the achievement phase peaks at ~300 keys (3/game) — under 500, so the scout's "top-20 stay warm in pass 2" holds. A **scaling aggravator** (not a mitigation): beyond `M≈166` (3M>500) late iterations evict early entries and force re-fetches, making cost *worse* than the linear estimate. |
| `server/jobs/snapshot.ts` | 148-170 | Sequential passes in `runSnapshotForUser`: `snapshotAchievements` (:148) → `recordAchievementUnlocks` (:153) → `refreshLibraryValueAggregate` (:160) → `refreshGameStoreData` (:167). All `await`ed one after another — steam bucket then store bucket, never in parallel. Confirmed. |
| `server/jobs/snapshot.ts` | 213-220 | `for (const id of targetSet) { … await runSnapshotForUser(id) … }` — serial per-user loop; wall-clock is `Σ over users`. Confirmed. |

---

## STEAM-7 / COMP-6 — Unbounded serial achievement recording through the shared `steamLimiter`

**Verdict: PLAUSIBLE** (mechanism CONFIRMED; wall-clock magnitude & truncation gated on runtime `M` + platform timeout tier).

### Evidence (opened this run)

| File | Line | Finding |
|------|------|---------|
| `server/jobs/snapshot.ts` | 26 | `export const ACHIEVEMENT_SNAPSHOT_LIMIT = 20;` — pass 1 is bounded to 20. |
| `server/jobs/snapshot.ts` | 274-277 | `snapshotAchievements` filters `hasAchievements` then `topGamesByPlaytime(..., 20)` — top-20 only. |
| `server/jobs/snapshot.ts` | 280-289 | `for (const game of candidates) { const result = await getGameAchievements(steamId, game.appId); … }` — serial `await` per game, pass 1. |
| `server/jobs/snapshot.ts` | 153 | `await recordAchievementUnlocks(resolvedSteamId, games);` — **no limit argument passed on the nightly path.** |
| `server/jobs/snapshot.ts` | 346-349 | `const all = games.filter((g) => g.hasAchievements); const candidates = limit !== undefined ? topGamesByPlaytime(all, limit) : all;` — `limit` undefined ⇒ `candidates = all`. **Unbounded** over every achievement-bearing game. |
| `server/jobs/snapshot.ts` | 352-356 | `for (const game of candidates) { … await getGameAchievements(steamId, game.appId); total += await upsertUnlockEvents(...) }` — serial `await` per game, pass 2. |
| `server/repositories/achievements.ts` | 55-59 | `getGameAchievements` fetches player progress FIRST (`cache(... getPlayerAchievements)`) — 1 `steamLimiter` call. |
| `server/repositories/achievements.ts` | 64-66 | `if (!playerAvailability.available) return playerAvailability;` — **ERR-0003 short-circuit**: private/no-achievement games cost exactly **1** `acquire()`, not 3. Scout credited this correctly. |
| `server/repositories/achievements.ts` | 70-77 | `const [schemaResult, globalResult] = await Promise.all([cache(... getSchemaForGame), cache(... getGlobalAchievementPercentages)])` — for *available* games, 2 more calls; `Promise.all` but both hit the 1-token `steamLimiter`, so they **serialize** → 3 serial limiter slots (~750 ms) per cold available game. |
| `lib/steam/achievements.ts` | 207 | `await steamLimiter.acquire();` inside `getPlayerAchievements` (call #1). |
| `lib/steam/achievements.ts` | 274 | `await steamLimiter.acquire();` inside `getSchemaForGame` (call #2). |
| `lib/steam/achievements.ts` | 312 | `await steamLimiter.acquire();` inside `getGlobalAchievementPercentages` (call #3). |

### Assessment
Mechanism reproduced exactly. Pass 1 (top-20) warms the in-process cache; pass 2 re-reads those 20 free and pays `3×250 ms` cold for the remaining `M−20` *available* games (fewer per unavailable game via the ERR-0003 short-circuit). The nightly call at `snapshot.ts:153` passes **no** limit, so pass 2 is genuinely unbounded and grows with library size. The `M×3×250 ms ≈ 75 s` (for `M=100`) is arithmetically right for the all-available case; it is an **upper bound**, since every private/no-achievement game drops to 1 call. Whether this is "merely slow" or "silently truncated" turns on `M` and the deployed timeout — neither readable from source. → PLAUSIBLE.

### Gated checks (human live lane — read-only; never run inside this verification)
- **`db-rowcount` / library size:** `SELECT COUNT(*) FROM OwnedGame o JOIN Game g ON g.appId=o.appId WHERE g.hasStats = 1 AND o.steamId = '<STEAM_ID>';` (or count `OwnedGame` and inspect `hasAchievements` from a live `GetOwnedGames`). Gives the real `M`. If `M×3×250 ms` (minus unavailable-game savings) exceeds the platform timeout with no margin, pass 2 truncates mid-run.
- **`platform-tier`:** Read the Vercel project's effective function timeout for `/api/cron/snapshot` (Hobby 10 s / Pro 60 s / Fluid up to 300 s). Settles slow-vs-truncated.
- **`jobrun`:** `SELECT status, startedAt, finishedAt, error FROM JobRun WHERE name='snapshot' ORDER BY startedAt DESC LIMIT 5;` — real per-run wall-clock and whether recent 03:00 runs completed `ok` or errored/were killed.

---

## STEAM-8 / COMP-5 — Onboarding backfill: 3N serial writes in one transaction + trailing unbounded fan-out on a request path

**Verdict: CONFIRMED (structural).** The static-code claims are fully verified, and the request-path claim is now *proven* (not merely asserted). Absolute seconds gated on `M`/`N`.

### Evidence (opened this run)

| File | Line | Finding |
|------|------|---------|
| `server/jobs/onboarding-backfill.ts` | 101 | `await prisma.$transaction(async (tx) => { … })` — one long-lived transaction wraps all reference writes. |
| `server/jobs/onboarding-backfill.ts` | 123-124 | `for (const game of games) { await tx.game.upsert({...})` — write #1/game, serial. |
| `server/jobs/onboarding-backfill.ts` | 142 | `await tx.ownedGame.upsert({...})` — write #2/game, same loop. |
| `server/jobs/onboarding-backfill.ts` | 163-170 | Second serial loop: `for (const game of games) { await tx.playtimeSnapshot.upsert({...}) }` — write #3/game. Total **3N** serial round-trips in one txn (no `createMany` — ERR-0005, SQLite). |
| `server/jobs/onboarding-backfill.ts` | 185 | `await recordAchievementUnlocks(id, games, opts?.achievementUnlockLimit);` — **outside** the txn; `achievementUnlockLimit` is **undefined** on the normal first-login path ⇒ inherits STEAM-7's unbounded `M`-game fan-out. |
| `app/onboarding/page.tsx` | 50 | `const result = await runOnboardingBackfill(steamId);` inside the async server component `OnboardingRunner` — **proves this runs on a request path** (RSC render), not a cron. |
| `app/onboarding/page.tsx` | 22 | `export const dynamic = 'force-dynamic'` and **no `maxDuration`** on this page ⇒ the first-login backfill inherits the platform default timeout. |
| `server/jobs/onboarding-backfill.ts` | 62-70 | Idempotency guard on `onboardedAt` — once per user (unless `force:true`). Confirmed. |

### Assessment
Every structural claim holds verbatim. The scout under-counted in one direction and I confirm the stronger reading: there are **two** serial write loops (`:123-159`, `:163-170`) inside a single `$transaction`, pinning one connection for `3N` round-trips, then a trailing unbounded achievement fan-out. The "on the first-login request path" claim — which the scout could only assert — is **proven** at `app/onboarding/page.tsx:50`. → CONFIRMED for mechanism.

### Blast-radius corrections
1. **Suspense softens "synchronous blocking" (scout under-weighted).** `OnboardingRunner` is a suspending async server component behind `<Suspense fallback={<OnboardingSkeleton/>}>` (`app/onboarding/page.tsx:115-117`). First paint is the skeleton — the user is **not** staring at a frozen white page for 75 s. What is still true and serious: the serverless invocation is held open for the whole backfill, and with **no `maxDuration` on `/onboarding`** a run exceeding the platform timeout breaks the stream mid-render. So "truncation risk" stands; "synchronous user-visible block with no feedback" should be re-stated as "streamed result delayed ~`M×3×250 ms`, truncatable."
2. **The resync path is BOUNDED, not unbounded (scout over-stated).** The scout's blast-radius line "`force:true` resync re-runs it" implies resync re-incurs the same unbounded cost. It does not: `app/settings/actions.ts:24` sets `ACHIEVEMENT_RESYNC_LIMIT = 20` and `:77` calls `resyncAccount(steamId, 20)` → `runOnboardingBackfill(steamId, { force:true, achievementUnlockLimit: 20 })` (`server/repositories/account.ts:79-84`), so `recordAchievementUnlocks` is capped to the top-20. Moreover the settings route carries `export const maxDuration = 60` (`app/settings/page.tsx:29`). **Only the first-login `/onboarding` path is both unbounded AND uncapped** — that is the real hazard, and it is narrower (once per new user) than "resync re-runs it" suggests.

### Gated checks (human live lane)
- **`n-games` / `M`:** same `OwnedGame`/`hasAchievements` counts as STEAM-7 set both the `3N` DB cost and the `M`-game achievement cost.
- **`db-rtt`:** the `0.9–2.3 s` DB estimate assumes Postgres at ~2–5 ms RTT × 450 round-trips. Confirm the deployed DB (SQLite dev ≈ sub-ms; Postgres-over-network is the stated prod path in CLAUDE.md) and its RTT. On SQLite the 3N loop is sub-second; the achievement fan-out dominates regardless.

---

## STEAM-6 — Nightly library-value + game-store double store pass (2N serial `storeLimiter` acquisitions)

**Verdict: PLAUSIBLE** (mechanism CONFIRMED; wall-clock magnitude gated on runtime `N` + platform tier).

### Evidence (opened this run)

| File | Line | Finding |
|------|------|---------|
| `server/repositories/library-value.ts` | 80 | `const prices = await Promise.all(games.map((g) => getGameStorePrice(g.appId)));` — N price calls, **all distinct appIds** (single-flight does not dedupe them). |
| `server/repositories/store.ts` | 32-35 | `getGameStorePrice` → `cache('store-price','global',appId, TTL.storePrice, () => getStorePrice(appId))`. |
| `lib/steam/store-client.ts` | 150 | `await storeLimiter.acquire();` inside `fetchEntry` (used by both `getStorePrice` and `getStoreMetadata`) — the 1-token bucket **serializes** the `Promise.all`, so effective cost = `N×250 ms`, not parallel. Confirmed. |
| `server/jobs/snapshot.ts` | 160 | `await refreshLibraryValueAggregate(resolvedSteamId, games);` — the price pass; runs **before** the metadata pass. |
| `server/jobs/snapshot.ts` | 167 | `await refreshGameStoreData(games);` — the second store pass, awaited after the price pass. |
| `server/repositories/game-store.ts` | 39-48 | `for (const game of games) { … await getGameStoreMetadata(game.appId); … await getGameStorePrice(game.appId); }` — serial per game. |
| `server/repositories/game-store.ts` | 42 | Metadata call → `getGameStoreMetadata` → `cache('store-metadata','global',appId, …)` — a **fresh** key not warmed by the price pass ⇒ N cold `storeLimiter` acquisitions. |
| `server/repositories/game-store.ts` | 48 | Price call → `getGameStorePrice` — same `store-price` key already warmed by `refreshLibraryValueAggregate` at `:160` ⇒ cache hit ⇒ ~0 acquisitions. Scout's "price warm ≈ 0" is correct. |

### Assessment
Confirmed: total store-bucket load ≈ `N` (price, in the library-value pass) `+ N` (metadata, in the game-store pass) = **2N** cold `storeLimiter` acquisitions, run **sequentially after** the ~75 s achievement work in the same invocation. `storeLimiter` being a separate bucket protects the request path but does nothing for job wall-clock, exactly as the scout argued. `N=150 ⇒ ~75 s` store subtotal; combined per-user cold wall-clock `≈ 150 s`. All arithmetic is right for the stated `N`; the absolute number and whether it blows the timeout depend on real `N` and the platform tier. → PLAUSIBLE.

Note on the in-process cache: `TTL.storeMetadata` is 7 d, but the Map is ephemeral across serverless invocations, so each 03:00 run is cold — the metadata pass really does pay `N` every night. Confirmed.

### Gated checks (human live lane)
- **`n-games`:** real owned-game count `N` for the featured `STEAM_ID` sets both store passes' cost.
- **`platform-tier`:** same timeout question as STEAM-7 — settles whether `~150 s` combined per-user wall-clock fits the deployed window.
- **`jobrun-timing`:** wall-clock of the two store passes from a real cron `JobRun.payload` / function-duration trace.

---

## Stale anchors (claimed vs actual at HEAD)

| File | Claimed | Actual | Note |
|------|---------|--------|------|
| `server/repositories/achievements.ts` | `68-75` (the schema+global `Promise.all`) | `70-77` | ~2-line drift; the block is `const [schemaResult, globalResult] = await Promise.all([...])`. Content matches. |
| `server/jobs/snapshot.ts` | scout prose "`recordAchievementUnlocks`'s loop is `snapshot.ts:352` (function opens at 341)" | loop `352`, fn opens `341`, candidates `349` | Accurate; scout already self-noted the 350→352 drift of 2 lines. |
| `server/jobs/snapshot.ts` | `280` (pass-1 loop) | `280` | Exact. |
| `server/repositories/library-value.ts` | `80` | `80` | Exact. |
| `lib/steam/store-client.ts` | `150` | `150` | Exact. |
| `server/repositories/game-store.ts` | `39-48` / `42,48` | `39`, `42`, `48` | Exact. |
| `server/jobs/onboarding-backfill.ts` | `123`, `163`, `185` | `123`, `163`, `185` | Exact. |

No materially stale anchor. The scout's line references are among the most accurate in this batch.

## Scout errors / over-statements (even on confirmed findings)

1. **STEAM-8 blast radius** — "`force:true` resync re-runs it" implies the resync path re-incurs the unbounded fan-out. It does not: resync is capped to top-20 (`app/settings/actions.ts:24,77`) and runs under `maxDuration=60` (`app/settings/page.tsx:29`). Corrected above.
2. **STEAM-8 request-path framing** — the scout hedged ("if the caller awaits it"). It *is* awaited on a request path (`app/onboarding/page.tsx:50`), but behind a `<Suspense>` skeleton, so "synchronous blocking with no feedback" over-states the UX; the truncation risk (no `maxDuration` on `/onboarding`) is the accurate hazard. Corrected above.
3. **Token-bucket "first token free"** — all three cost formulas use `K×250 ms`; the true floor is `(K-1)×250 ms` (the initial token is consumed immediately). ~250 ms over-count per pass — immaterial, noted for completeness.
4. **`single-flight` credit** — the `recordAchievementUnlocks` docstring (`snapshot.ts:336`) says `getGameAchievements` is "cached + single-flight". True (`server/cache.ts:36,93-107`), but single-flight only helps concurrent same-key misses; the serial distinct-appId loops get no benefit from it. Neither the scout nor I relied on it for a cost reduction — flagging so a fix author does not over-credit it.

## Cross-checks
- **`bug-3-insights-slow.evidence.md`** (already-adjudicated): confirms `server/cache.ts` is a pure in-process Map with no Redis in any environment — supports the "always cold at 03:00" premise here. The bug-3 receipt also confirms the ERR-0010/0011 read-aggregate migration that moved live store/metadata fan-out **off** the render path and **into** exactly these nightly refreshers (`refreshLibraryValueAggregate`, `refreshGameStoreData`) — i.e. STEAM-6 is the deliberate destination of that work, and the finding is correctly scoped to "consumes the job window," not "on the request path."
- **`docs/ERROR.md`**: ERR-0003 (`:20`,`:118`) = the 3-call/game achievement fan-out (short-circuit fix live at `achievements.ts:64-66`); ERR-0005 (`:22`,`:160`) = `createMany` unsupported on SQLite (why the 3N loop uses per-row upserts); ERR-0010 (`:27`,`:265`,`:272`) = the "priced every owned game live" dashboard regression that STEAM-6's nightly aggregate replaced; ERR-0011 (`:28`,`:286`) = the O(N) insights store/SteamSpy fan-out. All scout cross-refs check out.
