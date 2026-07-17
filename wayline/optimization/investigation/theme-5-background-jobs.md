# Theme 5 — Background Jobs (off request path; wall-clock + limiter pressure)

**Branch:** altan/optimization
**HEAD:** 13023e335764daed73900fabc0d88eab4d190eff
**Date:** 2026-07-09
**Phase:** investigation

## Scope & shared context

There is exactly **one** cron entry (`vercel.json`): `/api/cron/snapshot` at `0 3 * * *`
(03:00 UTC daily). **No `maxDuration` and no `runtime` export** exist on the cron route
(`app/api/cron/snapshot/route.ts` only sets `export const dynamic = 'force-dynamic'`).
That means the job inherits the Vercel platform default serverless function timeout
(10 s Hobby / 60 s Pro unless overridden; 300 s max on Fluid/Pro). This is the single
most important framing fact for this theme: **the snapshot job's wall-clock is uncapped
in code but hard-capped by the platform**, and everything below runs sequentially inside
that one window.

Three limiter buckets exist (`lib/steam/limiter.ts:85-101`), all 1 token:
- `steamLimiter` — 250 ms floor (Web API, `api.steampowered.com`)
- `storeLimiter` — 250 ms floor (Store API, `store.steampowered.com`) — **separate host/bucket**
- `steamSpyLimiter` — 1000 ms floor

**Which bucket each job call uses (verified this run):**
| Job call | Repo | lib client | Limiter |
|---|---|---|---|
| `snapshotAchievements` / `recordAchievementUnlocks` → `getGameAchievements` | `repositories/achievements.ts` | `lib/steam/achievements.ts` (`steamLimiter.acquire()` ×3) | **steamLimiter** |
| `refreshLibraryValueAggregate` → `getGameStorePrice` | `repositories/store.ts` | `lib/steam/store-client.ts` (`storeLimiter.acquire()`) | **storeLimiter** |
| `refreshGameStoreData` → metadata + price | `repositories/game-store.ts` | `store-client.ts` | **storeLimiter** |

Key structural fact: `runSnapshotForUser` (`snapshot.ts:89-180`) executes its heavy passes
**strictly sequentially** — playtime txn → `snapshotAchievements` (steamLimiter) →
`recordAchievementUnlocks` (steamLimiter) → `refreshLibraryValueAggregate` (storeLimiter) →
`refreshGameStoreData` (storeLimiter). And `runSnapshot` (`snapshot.ts:213-220`) loops
**users serially** (`for (const id of targetSet)`), so wall-clock is `Σ over users` of the
per-user sum. Currently single-user (featured `STEAM_ID`), but Phase 6 multi-user makes this
a linear multiplier on an already-tight window.

Assumption used for all cost math below: **N = 150 owned games**, of which **M ≈ 100 carry
achievements** (`hasAchievements === true`). These are stated estimates — the featured
library size is runtime data I cannot read here; see per-finding "measurement to close".

---

## STEAM-7 / COMP-6 — Serial achievement recording through the shared steamLimiter

**Anchor check:** original table cited `snapshot.ts:280,350`. Current lines: the
`snapshotAchievements` loop is `snapshot.ts:280`, and `recordAchievementUnlocks`'s loop is
`snapshot.ts:352` (the function opens at 341; `candidates` decision at 349). Anchors are
essentially accurate (350 → 352 drift of 2 lines).

**Verdict:** **confirmed** (mechanism) / cost is **needs-measurement** for absolute wall-clock.

### Mechanism
Two serial passes hit `steamLimiter`, the SAME bucket the interactive request path uses:
1. `snapshotAchievements` (`snapshot.ts:280`) loops the top-`ACHIEVEMENT_SNAPSHOT_LIMIT`
   (=20, `snapshot.ts:26`) achievement games and `await`s `getGameAchievements` one at a time.
2. `recordAchievementUnlocks` (`snapshot.ts:352`) then loops — with **no limit passed from the
   nightly path** — over **ALL** achievement-bearing games (`candidates = ... : all`,
   `snapshot.ts:349`), again one `await getGameAchievements` per game.

Each `getGameAchievements` costs up to **3** `steamLimiter.acquire()` calls on a cold cache
(player, then schema + global in parallel — `achievements.ts:68-75`; player-only short-circuit
for private/no-achievement games via ERR-0003 fix, so unavailable games cost 1). Because the
limiter capacity is 1 with a 250 ms refill and the loop is `for … await`, the calls fully
serialize at the 250 ms floor. The top-20 games fetched in pass (1) are cached, so pass (2)
re-fetches only the remaining `M−20` games cold. Nothing bounds pass (2) — it scales linearly
with the achievement-game count, which only grows as a library grows.

### Cost
Cold-cache nightly, N=150 / M=100:
- Pass 1 (top-20, all likely available/paid): `20 × 3 × 250 ms = 15.0 s`.
- Pass 2 (remaining 80 achievement games): `80 × 3 × 250 ms = 60.0 s` (fewer if many are
  private/unavailable → 1 call each).
- **Subtotal on steamLimiter ≈ 75 s** for one user, cold.

This alone exceeds a 60 s function window and rivals a 300 s max once the store passes
(below) and multi-user fan-out stack on top. Warm-cache nightly (TTL.playerAchievements =
3600 s, but the job runs once/day so the cache is **always cold at 03:00**) — so the cold
number is the realistic nightly cost, not a worst case.

**Measurement to close:** log actual `M` (games with `hasAchievements`) for the featured
`STEAM_ID` and the wall-clock of `recordAchievementUnlocks` from a real cron run
(`JobRun.payload` / server logs). If `M × 3 × 250 ms` < platform timeout with margin, it is
merely slow; if not, the job is silently truncated.

### Blast radius
Off request path (nightly + onboarding). **But** it shares `steamLimiter` with every
interactive Steam call — if the 03:00 job overlaps any live request (a user browsing at
03:00, or a manual `POST /api/cron/snapshot` triggered during the day), those requests queue
behind up to 75 s of job `acquire()`s. Risk grows with library size and, under Phase 6, with
user count (serial user loop). Primary hazard is **job truncation** (no `maxDuration`): a
timeout mid-`recordAchievementUnlocks` leaves that night's unlock events partially recorded —
idempotent on re-run, but Year-in-Review (#91, criterion #6) is incomplete until a full run
lands.

### Cross-refs
- ERR-0003 (docs/ERROR.md:118) — the 3-calls-per-game achievement fan-out; the same cost
  structure that was moved OFF the dashboard is exactly what dominates the nightly job here.
- STEAM-8/COMP-5 below — onboarding calls the very same `recordAchievementUnlocks` (imported
  at `onboarding-backfill.ts:25`, called at `:185`), so this cost also lands on a **request
  path** during first login.
- Theme themes covering the dashboard achievement summary (request-path fan-out) — same lib.

---

## STEAM-8 / COMP-5 — Onboarding backfill iterates games serially (Steam + 3× DB round-trips/game)

**Anchor check:** original cited `onboarding-backfill.ts:123`. Current: the `Game`/`OwnedGame`
upsert loop starts at `onboarding-backfill.ts:123`; a **second** serial loop for
`PlaytimeSnapshot` seeding is at `:163`. Anchor accurate; the finding under-counts (there are
two serial loops plus a trailing `recordAchievementUnlocks`).

**Verdict:** **confirmed.**

### Mechanism
`runOnboardingBackfill` runs on a user's **first sign-in** (request path, not cron). Inside one
big `prisma.$transaction(async (tx) => …)` (`:101-177`) it:
- loops all games doing **2 upserts each** — `tx.game.upsert` (`:124`) + `tx.ownedGame.upsert`
  (`:142`) — sequentially (`for (const game of games)`, `:123`), then
- loops all games **again** for `tx.playtimeSnapshot.upsert` (`:163-170`).

That is `2N + N = 3N` awaited DB round-trips inside a single transaction, all serial (no
`Promise.all`, no `createMany` — the latter is unavailable on SQLite per ERR-0005, but Postgres
prod could batch). Then **outside** the transaction it calls `recordAchievementUnlocks(id, games,
opts?.achievementUnlockLimit)` (`:185`) — with `achievementUnlockLimit` **undefined** on the
normal first-login path, so it inherits the full unbounded `M`-game steamLimiter fan-out from
STEAM-7.

### Cost
- DB: `3 × 150 = 450` serial round-trips in one transaction. On SQLite/local ≈ sub-ms each
  (~fractions of a second total); on Postgres-over-network at ~2–5 ms RTT ≈ **0.9–2.3 s**, all
  holding one long-lived transaction/connection open.
- Steam: the trailing `recordAchievementUnlocks` dominates — **~75 s** cold (same math as
  STEAM-7, M=100). This is the real cost, and it is on the **login request**.

### Blast radius
Every **new** user, once (idempotency-guarded by `onboardedAt`, `:62-70`; `force:true` resync
re-runs it). One-time per user, but it lands synchronously on the first-login request: if the
caller `await`s it, the user waits ~75 s (well past any HTTP/function timeout) or the request is
truncated mid-backfill. The long single transaction also pins a DB connection for its duration —
under concurrent onboarding (Phase 6 launch) that is connection-pool pressure. Same shared
`steamLimiter` contention as STEAM-7.

### Cross-refs
- Known bug **bug-04** (finding tagged `known:bug-04-adjacent`) — the multi-round-trip
  transaction pattern.
- ERR-0005 (docs/ERROR.md:160) — why `createMany` isn't used (SQLite); relevant to any batching
  fix direction.
- STEAM-7 — shared `recordAchievementUnlocks` cost.

---

## STEAM-6 — Nightly library-value pass: one Store call per game (+ a second per-game store pass)

**Anchor check:** original cited `library-value.ts:80`. Current: the fan-out is
`library-value.ts:80` — `await Promise.all(games.map((g) => getGameStorePrice(g.appId)))`.
Anchor exact.

**Verdict:** **confirmed** (mechanism). Cost is **needs-measurement** for absolute wall-clock.

### Mechanism
`refreshLibraryValueAggregate` (`library-value.ts:74`) prices **every** owned game:
`Promise.all(games.map(getGameStorePrice))` (`:80`). `Promise.all` looks parallel, but every
underlying `getStorePrice` does `await storeLimiter.acquire()` (`store-client.ts:150`) — a
1-token/250 ms bucket — so the N calls **serialize at the limiter** regardless of `Promise.all`.
Effective cost = `N × 250 ms`, not parallel.

Critically, this is **not the only** store pass in the job: `runSnapshotForUser` next calls
`refreshGameStoreData` (`snapshot.ts:167` → `game-store.ts:38`), which loops all games serially
doing `getGameStoreMetadata` **+** `getGameStorePrice` per game (`game-store.ts:42,48`). The
price call hits the cache warmed by the library-value pass (TTL.storePrice), but **metadata is a
fresh storeLimiter call per game**. So the job's total storeLimiter load ≈ `N` (price) `+ N`
(metadata) = **2N** cold acquisitions, all on the same bucket, sequential to each other because
the two passes are awaited one after the other.

Design note in the header (`library-value.ts:1-13`) is honest: this is deliberately off the
render path (the dashboard reads a precomputed `LibraryValueAggregate` row, zero fan-out). The
finding is not that it's on the request path — it's that it **consumes the shared job window**.

### Cost
N=150, cold: library-value price pass `150 × 250 ms = 37.5 s`; game-store metadata pass
`150 × 250 ms = 37.5 s` (price warm ≈ 0). **Store subtotal ≈ 75 s** on `storeLimiter`, added
**sequentially** after the ~75 s steamLimiter achievement work. Combined per-user job wall-clock
cold ≈ **150 s+**, before any multi-user multiplier — that blows a 60 s window outright and eats
half of a 300 s max for a single user.

`storeLimiter` is a **separate bucket** from `steamLimiter` (the #85 fix, `limiter.ts:87-94`),
so store calls do NOT starve the request-path Web API bucket. Good. But being a separate bucket
does nothing for **job wall-clock**, because the passes run sequentially in one function
invocation — the two buckets are never worked in parallel within `runSnapshotForUser`.

**Measurement to close:** capture real N for the featured library and the wall-clock of the two
store passes from a cron `JobRun`. Confirm whether the total per-user job time (steam + store)
fits the deployed platform timeout.

### Blast radius
Off request path entirely for reads (dashboard reads the aggregate row, `library-value.ts:44-60`).
The cost is job-window only: contributes ~half the per-user wall-clock and pushes the whole
snapshot toward truncation. If truncated after the achievement passes but before/within the
store passes, `LibraryValueAggregate` / `Game` price fields go stale for a day (graceful —
`getLibraryValue` returns last-good row or `not-tracked`). Multi-user (Phase 6) multiplies the
window linearly.

### Cross-refs
- ADR/#85 (limiter split) — `limiter.ts:87-94` comment; the very optimization that made this
  safe for the request path.
- docs/ERROR.md:272 — the dashboard "priced every owned game live" regression that motivated
  moving pricing into this nightly aggregate.
- STEAM-7 — the other half of the job window (steamLimiter); the two are additive.

---

## Theme-level ranking

1. **STEAM-7 / COMP-6 (dominant).** The unbounded `recordAchievementUnlocks` nightly fan-out
   (`M × 3 × 250 ms`, ~75 s cold) is the largest single contributor to job wall-clock, is
   unbounded by design (no limit on the nightly path), and grows with library size. It also
   re-lands on the request path via onboarding (STEAM-8).
2. **STEAM-6 (co-dominant on wall-clock).** ~75 s of serial storeLimiter work (price + metadata,
   2N) executed *sequentially after* STEAM-7 in the same invocation. Separate bucket protects the
   request path but not the job window. Together with STEAM-7, per-user cold wall-clock ≈ 150 s+.
3. **STEAM-8 / COMP-5 (highest user-visible impact, narrower frequency).** Same achievement
   fan-out but on a **first-login request**, plus 3N serial DB round-trips in one long
   transaction. Once per user, but synchronous on a request that cannot wait 75 s.

**The decisive, un-measured risk across all three:** the cron route sets **no `maxDuration`**.
Per-user cold wall-clock (~150 s) plus the **serial multi-user loop** (`snapshot.ts:213`) means
the job's real ceiling is the platform default timeout, and a truncated run silently drops that
night's unlock/value data (idempotent, so recoverable next night, but never "caught up" while
libraries/users grow).

## Open questions (need runtime data I cannot read here)
1. Featured library size **N** and achievement-game count **M** — sets every absolute number above.
2. Deployed platform tier and its effective function timeout (Hobby 10 s? Pro 60 s? Fluid 300 s?).
   Determines whether these are "slow" or "silently truncated".
3. Real per-run wall-clock and completion status from `JobRun` rows / cron logs (does the 03:00
   run currently finish, or error/timeout?).
4. How onboarding is invoked (awaited inline on the login request vs. deferred) — decides whether
   STEAM-8's 75 s is user-blocking or background.

## Fix directions (one line each — not plans)
- STEAM-7: pass an explicit bound to the nightly `recordAchievementUnlocks`, and/or batch/parallelize across a higher limiter budget or chunked runs.
- STEAM-8: replace the per-game serial upsert loops with a batched write (Postgres `createMany`/`$transaction` batching) and move/queue the achievement seeding off the login request.
- STEAM-6: fold the two store passes into one per-game call (metadata+price together) and/or set an explicit `maxDuration` so the window is intentional, not platform-default.

## Evidence

| File:line | Verbatim (opened this run) |
|---|---|
| `vercel.json:4-9` | `"crons": [ { "path": "/api/cron/snapshot", "schedule": "0 3 * * *" } ]` — sole cron |
| `app/api/cron/snapshot/route.ts` | only `export const dynamic = 'force-dynamic'`; **no `maxDuration`/`runtime`** |
| `lib/steam/limiter.ts:85` | `export const steamLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` (250 ms) |
| `lib/steam/limiter.ts:94` | `export const storeLimiter = new TokenBucketLimiter(1, REFILL_INTERVAL_MS);` (separate bucket) |
| `snapshot.ts:213-220` | `for (const id of targetSet) { … await runSnapshotForUser(id) … }` — serial user loop |
| `snapshot.ts:148-170` | sequential passes: `snapshotAchievements` → `recordAchievementUnlocks` → `refreshLibraryValueAggregate` → `refreshGameStoreData` |
| `snapshot.ts:26` | `export const ACHIEVEMENT_SNAPSHOT_LIMIT = 20;` |
| `snapshot.ts:280-289` | `for (const game of candidates) { const result = await getGameAchievements(steamId, game.appId); … }` |
| `snapshot.ts:349` | `const candidates = limit !== undefined ? topGamesByPlaytime(all, limit) : all;` — nightly = **all** |
| `snapshot.ts:352-356` | `for (const game of candidates) { … await getGameAchievements(steamId, game.appId); total += await upsertUnlockEvents(...) }` |
| `achievements.ts:68-75` | `const [schemaResult, globalResult] = await Promise.all([cache(... getSchemaForGame), cache(... getGlobalAchievementPercentages)])` — 3 steamLimiter calls/game cold |
| `lib/steam/achievements.ts:207,274,312` | `await steamLimiter.acquire();` ×3 |
| `library-value.ts:80` | `const prices = await Promise.all(games.map((g) => getGameStorePrice(g.appId)));` — N store calls |
| `lib/steam/store-client.ts:150` | `await storeLimiter.acquire();` before each store fetch → serializes the `Promise.all` |
| `game-store.ts:39-48` | `for (const game of games) { … await getGameStoreMetadata(game.appId); … await getGameStorePrice(game.appId); }` — 2nd store pass, metadata fresh |
| `onboarding-backfill.ts:123-159` | `for (const game of games) { await tx.game.upsert(...); await tx.ownedGame.upsert(...); }` — 2 writes/game |
| `onboarding-backfill.ts:163-170` | second `for (const game of games) { await tx.playtimeSnapshot.upsert(...); }` — 3rd write/game |
| `onboarding-backfill.ts:185` | `await recordAchievementUnlocks(id, games, opts?.achievementUnlockLimit);` — limit undefined on first login |
| `docs/ERROR.md:118` | ERR-0003 — dashboard cold load ~38s from library-wide 3-call achievement fan-out |
| `docs/ERROR.md:160` | ERR-0005 — `createMany({ skipDuplicates })` unsupported on SQLite |
| `docs/ERROR.md:272` | dashboard regression: "rendering it priced every owned game live" |
