# PLAN — Theme 2: Per-game external fan-outs on request paths

**Theme:** 2 — Per-game external fan-outs on request paths
**Branch:** `altan/optimization` · **Investigation HEAD:** `13023e3` · **Date:** 2026-07-09
**Inputs:** `wayline/optimization/investigation/theme-2-external-fanouts.md` (scout) · `wayline/optimization/verification/theme-2-external-fanouts.evidence.md` (adversarial receipt, authoritative) · `wayline/optimization/investigation/SUMMARY.md` (adjudication + dependencies)
Status: DRAFT — pending adversarial review.

---

## Root causes addressed

| ID | Reviewer verdict | Receipt justification | Gated check (named in receipt) |
|---|---|---|---|
| STEAM-1 | **CONFIRMED** | `/library?multiplayer=1` fires one live Store `appdetails` call per owned game via `Promise.all` in `getMultiplayerAppIds` (`server/repositories/multiplayer.ts:47`); each call drains the capacity-1/250 ms `storeLimiter` serially → ~16.3 s cold @ N=65, linear in library size. Independently verified that `model Game` has **no** `categoryIds` column and `grep categoryIds` never hits a persisted field — unlike genres/price (ERR-0010/0011). | Real library size N (all cost math assumes the documented N=65; a prod `OwnedGame` count confirms the multiplier). |
| STEAM-4 | **CONFIRMED** | `steamLimiter` is one process-global capacity-1 bucket with a single FIFO `waiting` queue (`lib/steam/limiter.ts:19,37-41,68-81,85`), no per-user partitioning; contention multiplier ≈ C users × k calls × 250 ms serialized per instance. Host-split from `storeLimiter`/`steamSpyLimiter` verified. | Vercel instance concurrency (how many users share one process's bucket). |
| STEAM-2 / DATA-8 | **CONFIRMED (mitigated — residual only)** | Dashboard achievement fan-out (≤3 Web-API calls/game) is real, but all four mitigations verified present at HEAD: top-20 cap (`app/page.tsx:85-89`), private-profile short-circuit (`achievements.ts:64-66`), per-section `<Suspense>` (`app/page.tsx:139,162-163`), cache single-flight (`server/cache.ts:34-36,93-107`). Residual = up to ~15 s serial cold path, off first paint. | None beyond N (above); ERR-0003 already recorded before/after. |
| STEAM-5 | **PLAUSIBLE** | Retry schedule `[250,1000,4000]` = +5.25 s per terminally-failing transient call verified; `steamLimiter.acquire()` sits **outside** `withRetry` (`lib/steam/achievements.ts:207,211`) so retries burn wall-clock only, never extra tokens; Store and SteamSpy clients do not retry. Magnitude gated on prod transient-failure rate — **no task**; gated check preserved in the measurement plan. | `web-api-transient-rate` — Vercel function logs for `/`, or a counter on `withRetry` exhaustion (`lib/steam/retry.ts:59`), per endpoint. |

### Folded / excluded

| ID | Disposition | Reason |
|---|---|---|
| STEAM-3 / DATA-1 / RSC-3 | **Out-of-lane (bug-3 remnant, dormant)** | The `/insights/genres` SteamSpy per-game loop (~65 s cold when `ENABLE_STEAMSPY=1`; ERR-0011 measured 64.8 s; flag defaults OFF per `server/env.ts:33-36`) is bug-3 root-cause #1 and is owned by the bug-3 fix lane ("persist SteamSpy tags nightly"). No duplicate task here; the `ENABLE_STEAMSPY` prod-value gated check is carried in the measurement plan so it is never lost. |
| STEAM-9 | **Structural constraint, not a task** | No batch `appdetails` endpoint exists (`lib/steam/store-client.ts:147` — one `appids=${appId}` per call). It cannot be "fixed"; it dictates the STEAM-1 fix shape: precompute into a `Game` column, because any request-path `Promise.all` still serializes at the limiter. |
| STEAM-5 | **Gated check only** | See table above — PLAUSIBLE, task creation gated on the measured transient rate. |
| STEAM-4 (partitioning) | **Explicitly deferred to Phase 6** | Decided below in "Chosen fix" — stated as a scoped dependency, not silently dropped. |

---

## Chosen fix

**One sentence:** neutralize the last request-path O(N) Store fan-out (STEAM-1) with the repo's twice-proven precompute pattern — persist `categoryIds` into the `Game` row during the nightly job's *existing* Store metadata pass, and rewrite `getMultiplayerAppIds` to read the DB — plus one cheap, mitigation-preserving residual improvement for STEAM-2 (right-sized TTLs for the per-app schema/global achievement caches).

### Mechanism — why this removes the root cause, not the symptom

**STEAM-1.** The root cause is not "the Store is slow" — it is that multiplayer classification is computed from **live** Store data on the request path, when the classification input (`categoryIds`) is slow-changing reference data that the nightly job *already fetches*. `refreshGameStoreData` (`server/repositories/game-store.ts:38`, called from `server/jobs/snapshot.ts:167`) already calls `getGameStoreMetadata(g.appId)` per game **off the request path** to persist `genres` — the very same `StoreMetadata` object carries `categoryIds` (`lib/steam/store-client.ts:34,210`) and is currently thrown away. So the fix is:

1. Add a nullable `categoryIds String?` column to `model Game` (JSON-encoded number array, mirroring the existing `genres String` JSON-array convention at `prisma/schema.prisma:55`). `null` = never refreshed → maps to "uncategorized", never fabricated.
2. In `refreshGameStoreData`, persist `categoryIds` from the metadata result it already holds — **zero additional Store calls, zero additional limiter pressure**; the nightly job's wall-clock is unchanged.
3. Rewrite `getMultiplayerAppIds` to one `prisma.game.findMany({ where: { appId: { in: appIds } }, select: { appId, categoryIds } })` + the existing pure classifier `isMultiplayerGame(categoryIds)` (`lib/games/multiplayer.ts:16`). The public interface (`MultiplayerLibrary` = `{ multiplayerAppIds, missingCount, stale }`) is unchanged; games with `categoryIds: null` (never refreshed) count into `missingCount`, exactly the existing designed degradation the library page already renders ("Some games could not be categorized", `app/library/page.tsx:84-95`).

Result: `/library?multiplayer=1` goes from N×250 ms of limiter-bound Store I/O (~16.3 s cold @ 65 games, unbounded in N) to **one indexed DB read plus the pre-existing `getProfile(id)` call (retained; ≤2 Web-API calls, in practice a cache hit because `app/library/page.tsx` already resolved the same profile before the multiplayer branch) — O(1) in external calls, zero Store calls** — the same trajectory ERR-0010 (`LibraryValueAggregate`) and ERR-0011 (`Game.genres`/price) already shipped. It also stops the filter from contending with the nightly library-value Store pass on `storeLimiter`.

**STEAM-4 — decide-or-defer (binding requirement): DEFERRED to Phase 6, with reason.** Limiter partitioning (per-user fairness queues) is **out of scope for this plan**. Reasons: (a) the durable fix the receipt itself names is removing fan-outs — T1–T3 delete the largest remaining request-path fan-out, directly shrinking the C×k×250 ms multiplier; (b) the app is single-user today (Phase 6 multi-user auth is in flight, not shipped), so partitioning has no measurable payoff until then and would be tuned blind; (c) per the receipt, each Vercel instance has its own bucket, so the real contention profile depends on instance concurrency — a Phase-6-time gated measurement. **Scoped dependency:** the Phase 6 workstream MUST revisit STEAM-4 (per-user fairness or partitioned buckets) with the instance-concurrency measurement in hand; this plan records that hand-off and changes nothing in `lib/steam/limiter.ts`.

**STEAM-2 residual (cheap only — mitigation preserved).** The four verified mitigations are untouched. The one cheap, code-level residual: the per-app schema and global-percentage caches reuse `TTL.playerAchievements` (1 h) at `server/repositories/achievements.ts:71-77`, but game schemas and global unlock percentages are slow-moving per-app reference data (already keyed under the `'global'` pseudo-steamId). Add dedicated `achievementSchema` (7 d, matching `storeMetadata`) and `achievementGlobal` (24 h) entries to `server/cache/ttl.ts` and use them. On a warm instance this cuts the recurring cold path from 3 calls/game back toward 1 (the per-user call), i.e. ~15 s → ~5 s per cache-expiry cycle. **Stated dependency:** because `server/cache.ts` is an in-process Map (settled in the bug-3 receipt), this improvement resets on serverless cold start; the durable-cache decision belongs to bug-3's fix lane — this plan depends on it for full effect but does not decide it. The full precompute of per-user achievement totals (the ERR-0003 "Phase 2" direction; receipt: "precompute per-user achievement totals nightly, dashboard reads one aggregate row, mirrors LibraryValueAggregate") is deliberately **not** planned here, and — to be honest about ownership — it is **not owned by any other theme either**: Theme 5's plan bounds `recordAchievementUnlocks` (per-achievement unlock *event* rows, STEAM-7/8), which is a different surface from a per-user achievement-*totals* aggregate for the dashboard KPI. STEAM-2's durable precompute is therefore an explicitly **deferred, currently-unowned residual**: this plan ships only the cheap TTL residual (T4) and records the deferred precompute in the ERR entry's "where else" note so the finding cannot be silently dropped by a false hand-off. If/when it is scheduled, it should coordinate with Theme 5's nightly-job wall-clock budget (shared job window), but building it would not diverge from Theme 5's unlock-recording fix.

### Rejected alternatives

1. **Request-path concurrency (widen `storeLimiter`, or chunked `Promise.all` with higher parallelism) for STEAM-1.** Rejected: STEAM-9 makes this a dead end — there is no batch endpoint, so N calls must happen somewhere; widening the limiter just trades our rate-limit safety margin against Steam's undocumented Store throttle (the 250 ms floor exists to avoid 429s), still leaves the path O(N) and linear in library size, and still contends with the nightly value pass. The receipt is explicit: "Promise.all still serializes at the limiter."
2. **Cache-only fix (bump `TTL.storeMetadata` beyond 7 days / pre-warm the cache on boot) for STEAM-1.** Rejected: the cache is an in-process Map that empties on every serverless cold start (bug-3 receipt, SUMMARY dependency note) — every "warm cache" mitigation is ephemeral, so the first filter activation per instance still pays the full ~16.3 s. Persisting to the `Game` row is the only design where cold start costs nothing.
3. **On-demand write-through (compute-and-persist categoryIds lazily on first filter use).** Rejected: first user still eats the full 16.3 s wall (the exact symptom), the write path would run inside an RSC render (side-effectful render, against repo architecture), and it duplicates persistence logic the nightly job already owns.
4. **Partition `steamLimiter` per user now (STEAM-4).** Rejected for this phase — see decide-or-defer above.

---

## Invariants compliance

| Invariant | How this plan respects it |
|---|---|
| TTLs only in `server/cache/ttl.ts` | T4 adds `achievementSchema`/`achievementGlobal` **to the TTL map**; no literals in `achievements.ts`. No *existing* TTL value is touched. **Cross-theme co-edit note:** Theme 1's plan adds `insightsAggregate` to the same frozen TTL object literal — the keys are disjoint and logically compatible, but whichever theme lands second must rebase over the other's edit to this block. |
| `withErrorBoundary` owns error mapping; no handler try/catch | No route handlers change. The existing `.catch(...)` in `app/library/page.tsx:88` (RSC degradation, not a handler) is preserved as-is. |
| Zod at every I/O boundary; unexpected shape → `SteamApiError kind:"schema"` | No new I/O boundary with Steam: `categoryIds` comes from the already-Zod-parsed `StoreMetadata` (`lib/steam/store-client.ts:210`). Reading `Game.categoryIds` back parses the JSON string defensively — malformed stored JSON is treated as `null` → `missingCount` (degrade), never a crash. |
| Degrade, never crash or fabricate | `categoryIds: null` (game never refreshed by the job, or Store returned unavailable with no prior value) → excluded from the set and counted in `missingCount`, feeding the existing "Some games could not be categorized" designed state. A game is **never** silently classified non-multiplayer from missing data. **Unavailable-handling rule (single, binding): on unavailable metadata the `categoryIds` field is OMITTED from the upsert `update` (column left untouched — last-known-good; `null` on `create`). `'[]'` must NEVER be written on unavailable** — an empty array is a *positive* "no multiplayer categories" classification: the T3 reader would classify `isMultiplayerGame([]) === false` and exclude the game from `missingCount`, fabricating a non-multiplayer verdict from missing data. Note this **deliberately diverges** from `refreshGameStoreData`'s genre behavior, which resets `genres = '[]'` on unavailable (`server/repositories/game-store.ts:43-45`, pinned by `tests/unit/game-store.test.ts` "writes genres=[] when metadata is unavailable"); for genres `'[]'` is a safe empty display state, for `categoryIds` it is a fabricated classification — the divergence is the invariant, not an oversight, and must be documented in the T2 code comment. |
| `steamId` is a string everywhere | Untouched; `getMultiplayerAppIds(steamId: string)` signature unchanged, `requireSteamId` retained. |
| Migrations immutable; new work = follow-up migration | One new **additive** migration (nullable column on a reference table) — no existing migration is edited. This is the "unavoidable" case: a persisted precompute needs a column; Theme 1's no-migration note (DATA-7) covers indexes, not this. Reference-table upsert semantics respected: `Game` rows are upserted, and the job update is idempotent (re-running writes the same value). |
| Cron: `x-cron-secret` via `timingSafeEqual`, idempotent jobs | No new cron route — the work rides inside the existing guarded nightly job (`server/jobs/snapshot.ts:167` → `refreshGameStoreData`). Idempotency inherited: re-persisting `categoryIds` is a pure upsert of reference data. |
| RSC by default; skeletons; empty states | No client components added or changed. `/library` stays RSC; the existing empty/uncategorized states are reused unchanged. |
| Perf budget (<200 KB JS, LCP <2.5 s) | Zero client JS added. Server-side, the change strictly removes I/O. |
| Stale-while-revalidate | The DB read replaces the cache path for multiplayer; the DB carries no stale-while-revalidate signal (`categoryIds` is nightly-refreshed reference data, exactly like `genres`, which surface no staleness), so `stale` in `MultiplayerLibrary` is **pinned to `false`** (explicit T3 acceptance criterion) — never a fabricated freshness signal; data gaps surface via `missingCount` semantics only. |

---

## Task breakdown

Ordering: T1 → T2 → T3 are a strict sequence (schema → writer → reader). T4 is independent and can run in parallel. Note SUMMARY sequencing: Theme 3 (shell streaming) lands first for *measurement* validity — these tasks are functionally independent of it, but before/after LCP numbers must be taken after Theme 3 ships.

### T1 — Schema: add `Game.categoryIds` (follow-up migration)
**Scope in:** `prisma/schema.prisma` (add `categoryIds String?` to `model Game`, JSON-encoded number array, comment mirroring `genres`), one new migration under `prisma/migrations/`. **Scope out:** all application code; no changes to existing migrations; no indexes (lookups are by `appId` PK).
**Acceptance criteria:**
- `pnpm prisma migrate dev` creates a new migration adding a nullable column; no existing migration file's checksum changes (`git status` on `prisma/migrations/**` shows only additions).
- `pnpm typecheck` green; regenerated Prisma client exposes `Game.categoryIds: string | null`.
- Existing rows read back with `categoryIds === null` (no backfill in the migration — the job populates it).

### T2 — Writer: persist `categoryIds` in `refreshGameStoreData`
**Scope in:** `server/repositories/game-store.ts` — when metadata is *available*, write `categoryIds = JSON.stringify(meta.categoryIds)` in the existing `Game` upsert; when *unavailable*, **omit the `categoryIds` field from the upsert `update` entirely** (column untouched — last-known-good; `null` on `create`), per the binding unavailable-handling rule in Invariants compliance. This is intentionally **not** the genre behavior (genres reset to `'[]'` on unavailable) — never write `'[]'` for `categoryIds` on unavailable. Update the module's "Column mapping" doc comment (lines 27-33) with the new mapping and the divergence rationale. Per-game failure never aborts the pass. Corresponding unit tests in `tests/unit/game-store.test.ts`. **Scope out:** `server/jobs/snapshot.ts` (call site unchanged), `getGameStoreMetadata` (unchanged), any new Store call.
**Acceptance criteria:**
- After a job run against fixture metadata, `Game.categoryIds` holds the JSON array of the fixture's category ids; a game whose metadata is `unavailable` retains its previous `categoryIds` value (last-known-good — the update omits the field), and a never-seen game with unavailable metadata is created with `categoryIds = null`. `'[]'` is never written on unavailable. The existing genre-unavailable test (`writes genres=[] when metadata is unavailable`) stays green unchanged.
- Store call count per game is **unchanged** (assert the mocked `getGameStoreMetadata` call count equals N, same as before the change — zero added limiter pressure).
- Re-running the job on the same input is idempotent (second run produces identical rows).

### T3 — Reader: `getMultiplayerAppIds` reads the DB, zero Store calls
**Scope in:** `server/repositories/multiplayer.ts` (replace `getProfile` + `Promise.all(getGameStoreMetadata)` with `getProfile` for the owned set + one `prisma.game.findMany` select of `appId, categoryIds`; classify with existing `isMultiplayerGame`; `null`/missing/unparseable → `missingCount`), **plus a rewrite — not extension — of `tests/integration/multiplayer-repo.test.ts`**: that suite's entire premise is MSW interception of Store `appdetails` HTTP calls (`appDetailsBody(appId, categoryIds)` builds category HTTP responses; cases: mixed library, metadata-unavailable, non-200, empty, no-multiplayer). Once T3 removes all Store calls, every one of those cases loses its premise and must be migrated to seed `Game` rows in the test DB instead (mixed → seeded mixed `categoryIds`; metadata-unavailable/non-200 → seeded `null` rows; empty/no-multiplayer → seeded accordingly). This migration is explicit T3 regression work and part of its estimate. **Scope out:** `app/library/page.tsx` (interface unchanged — verify no edit needed beyond none), `lib/games/multiplayer.ts` and its pure-classifier suite `tests/unit/multiplayer-filter.test.ts` (untouched), `server/repositories/store.ts`.
**Acceptance criteria:**
- `getMultiplayerAppIds` performs **zero** calls to `getGameStoreMetadata`/`storeLimiter` (assert mock never called).
- Return shape `{ multiplayerAppIds, missingCount, stale }` unchanged; games with `categoryIds: null` or malformed JSON land in `missingCount` and never in the set.
- `stale` is **always `false`** — the DB read carries no stale-while-revalidate signal, and no freshness signal may be fabricated; the rewritten suite asserts `stale === false` on the return shape.
- Every behavioral case in the pre-T3 `multiplayer-repo.test.ts` suite has a DB-seeded equivalent in the rewritten suite (no case silently dropped).
- `/library?multiplayer=1` renders correctly against a seeded dev DB: multiplayer games filtered, uncategorized note shown when `missingCount > 0`, no thrown error when the `Game` table is empty (all games → `missingCount`, designed state renders).
- `pnpm test` and `pnpm typecheck` green.

### T4 — STEAM-2 residual: right-sized TTLs for per-app achievement reference data
**Scope in:** `server/cache/ttl.ts` (add `achievementSchema: 604800`, `achievementGlobal: 86400`), `server/repositories/achievements.ts:71-77` (use the new keys for the two `'global'`-scoped caches only), tests. **Scope out:** `TTL.playerAchievements` (per-user, stays 1 h), the top-20 cap, short-circuit, Suspense, single-flight — **all mitigations untouched**; no precompute of achievement totals (Theme 5 lane); `lib/steam/*` unchanged.
**Acceptance criteria:**
- The player-achievements cache still uses `TTL.playerAchievements`; only the schema/global caches use the new keys (assert cache called with expected TTL values).
- No TTL literal appears in `achievements.ts` — only `TTL.*` references.
- Dashboard behavior unchanged in tests (ERR-0003 suite still green); documented in the task that the win is warm-instance-only pending the bug-3 durable-cache decision.

---

## TDD test plan

Write these failing tests FIRST; each goes red at HEAD and green after its task — **except #3**, which is a green-throughout regression tripwire (it guards the zero-added-Store-calls claim and is expected to pass at HEAD and after T2 alike).

| # | File | Test name | Red → green assertion |
|---|---|---|---|
| 1 | `tests/unit/game-store.test.ts` (extend existing suite) | `persists categoryIds alongside genres for available metadata` | Red: `Game.categoryIds` column/write does not exist. Green (T1+T2): after `refreshGameStoreData`, row has `categoryIds === JSON.stringify([1, 36])` from fixture metadata. |
| 2 | same file | `leaves categoryIds untouched when metadata is unavailable` | Red: n/a column. Green (T2): pre-seeded value survives an `unavailable` pass (update omits the field; create writes `null`) — last-known-good, never `'[]'`, never fabricated. Sits alongside — and must not alter — the existing `writes genres=[] when metadata is unavailable` test, which pins the *different* genre semantics. |
| 3 | same file | `adds no extra Store calls` | Red-proof by construction: assert `getGameStoreMetadata` mock call count === games.length before and after — guards the zero-added-limiter-pressure claim (green throughout; regression tripwire). |
| 4 | `tests/integration/multiplayer-repo.test.ts` (**rewrite** — MSW `appdetails` interception → DB-seeded `Game` rows, per T3 scope) | `classifies from persisted Game.categoryIds without any Store call` | Red at HEAD: current impl calls `getGameStoreMetadata` N times. Green (T3): store mock/MSW handler sees 0 `appdetails` requests; set matches seeded multiplayer category ids; `stale === false`. |
| 5 | same file | `counts never-refreshed (null) and malformed categoryIds into missingCount` | Red: null rows currently trigger live fetches instead. Green (T3): `missingCount` equals count of null + unparseable rows; none appear in the set. |
| 6 | same file | `empty Game table degrades to all-uncategorized, never throws` | Red/green per T3: `{ multiplayerAppIds: empty, missingCount: games.length, stale: false }`. |
| 7 | `tests/unit/achievements-repo.test.ts` (existing suite) | `schema and global caches use dedicated reference TTLs; player cache unchanged` | Red at HEAD: all three use `TTL.playerAchievements`. Green (T4): cache spy sees `TTL.achievementSchema` / `TTL.achievementGlobal` for the `'global'` keys and `TTL.playerAchievements` for the per-user key. |

The pure classifier's suite `tests/unit/multiplayer-filter.test.ts` needs no change (classifier untouched) but must stay green.

---

## Affected files

Verified present at HEAD `13023e3` with the named exports/lines:

- `prisma/schema.prisma` — `model Game` (currently `genres String` :55, price fields :64-67; **no** `categoryIds`) — T1 adds the column.
- `prisma/migrations/<new>/migration.sql` — T1, additive only (latest existing: `20260619085604_add_game_price_fields`).
- `server/repositories/game-store.ts` — `refreshGameStoreData` (:38) — T2 writer change.
- `server/repositories/multiplayer.ts` — `getMultiplayerAppIds` (:43), `Promise.all` fan-out (:47) — T3 rewrite; interface `MultiplayerLibrary` (:17) preserved.
- `server/cache/ttl.ts` — `TTL` map — T4 adds two keys.
- `server/repositories/achievements.ts` — schema/global cache calls (:71-77) — T4 TTL-key swap only.
- Tests: `tests/unit/game-store.test.ts` (extend, T2), `tests/integration/multiplayer-repo.test.ts` (rewrite, T3), `tests/unit/achievements-repo.test.ts` (extend, T4) — verified present at HEAD via `find tests` (there is no `tests/server/` tree); these match the TDD-plan table rows 1–7 exactly.
- **Read but unchanged (regression surface):** `app/library/page.tsx` (:84-95 caller + degradation UI), `lib/games/multiplayer.ts` (pure classifier), `server/repositories/store.ts`, `lib/steam/store-client.ts`, `lib/steam/limiter.ts` (explicitly untouched — STEAM-4 deferred), `lib/steam/retry.ts` (untouched — STEAM-5 gated), `server/jobs/snapshot.ts` (:167 call site unchanged).

---

## Measurement plan

**Sequencing caveat (binding, from SUMMARY):** Theme 3 (RSC-1/2 shell streaming) must land before before/after LCP numbers are taken — the shell masks page-level wins. The STEAM-1 metric below is a *server-duration* metric, so it is meaningful pre-Theme-3; user-visible LCP deltas are only attributable post-Theme-3.

**Primary metric — STEAM-1:**
- *What:* wall-clock of the multiplayer-filter data path — `performance.now()` around the `getMultiplayerAppIds` await in `app/library/page.tsx:88` (temporary instrumentation or Vercel function-duration trace for `/library?multiplayer=1`), cold cache / fresh instance.
- *Before:* expected ≈ N × 250 ms (~16.3 s @ N=65). *After:* one DB read plus the retained `getProfile` call (expected cache hit — the page resolves the same profile earlier in the render), target < 100 ms, **independent of N**.
- *Recorded in:* `docs/ERROR.md` new ERR entry (see below), before/after fields, following the ERR-0010/0011 format.

**Secondary — STEAM-2 residual (T4):** on a warm instance, second dashboard cold-cache cycle after 1 h: count of Steam Web-API calls for the top-20 set drops from ≤60 toward ≤20 (schema/global still cached). Record alongside the ERR entry. Note explicitly: resets on cold start until the bug-3 durable-cache decision.

**Gated checks preserved (no task until they land; human/live lane, read-only):**
1. **`ENABLE_STEAMSPY` prod value** (STEAM-3 / bug-3 carryover) — 30-second Vercel env check; decides whether the dormant ~65 s genres path is live. Owned by bug-3 lane; kept visible here so it is never lost.
2. **`web-api-transient-rate`** (STEAM-5) — Vercel function logs for `/` over a representative window, or a counter incremented when `withRetry` (`lib/steam/retry.ts:59`) exhausts attempts, per endpoint. If terminal-transient rate f ≈ 0, STEAM-5 stays a non-issue; if materially > 0, added dashboard latency ≈ failing-calls × 5.25 s → open a follow-up task then.
3. **Real library N** — prod `OwnedGame` count per steamId; confirms the STEAM-1/2 multipliers (all math assumes documented N=65; dev DB empty).
4. **Vercel instance concurrency** (STEAM-4) — determines the real contention multiplier; feeds the Phase 6 partitioning decision this plan defers.
5. **Platform tier / function timeout** — shared with Theme 5; only touches this plan as context for the nightly job window (T2 adds zero job wall-clock, so no new exposure).

---

## Risk & rollback

**Regression surface vs the 5 shipped bug fixes:**
- **bug-1 history-no-data / bug-2 year-in-review-zero-hours:** untouched surfaces (`snapshots.ts`, insights year-in-review) — no shared files. Risk: none.
- **bug-3 insights-slow:** T2 edits `game-store.ts`, the ERR-0011 fix file. Risk: breaking the genres/price persistence. Mitigation: tests #1–#3 assert genres writes and Store call counts unchanged; the existing ERR-0011 suite must stay green. The SteamSpy remnant and durable-cache decision remain bug-3-owned — this plan adds no conflicting change.
- **bug-4 obs-software-title:** untouched surfaces. Risk: none.
- **bug-5 insights-unknown-label:** shares `server/repositories/game-store.ts` with T2 (the bug-5 receipt cites `game-store.ts:42-45` as the genres data source). The genres write logic is preserved verbatim and guarded by the existing `writes genres=[] when metadata is unavailable` assertion plus tests #1–#3 (genres writes and Store call counts unchanged). Risk: mitigated, not "none" — same bucket as bug-3.
- **ERR-0003 dashboard mitigation (adjacent to bug fixes):** T4 touches `achievements.ts` cache calls only; top-20/short-circuit/Suspense/single-flight asserted untouched by test #7 + existing suite.

**Other risks:**
- *Stale categories:* `categoryIds` refreshes nightly, so a game whose Store categories change is up to ~24 h stale (plus the job's own cadence). Accepted — identical to the shipped genres/price trade-off (ERR-0011), and strictly fresher than the old 7-day `TTL.storeMetadata` warm path.
- *First-run gap:* until the first post-deploy nightly job, all `categoryIds` are `null` → filter shows everything as uncategorized (designed state, not a crash). Mitigation: run the guarded cron once manually after deploy; document in the ERR entry.
- *Migration on prod Postgres:* additive nullable column, no lock risk at this table size.
- *T4 achievement-schema staleness window:* raising the `achievement-schema` cache from 1 h (`TTL.playerAchievements`) to 7 d means a game that gains new achievements (e.g. DLC) can render those achievements without display names/icons for up to 7 days on a warm instance (today: ≤1 h). Accepted: achievement schemas change only on developer pushes (rare, DLC-cadence), practical exposure is bounded by serverless cold starts emptying the in-process cache far sooner than 7 d, and the affected surface degrades (missing name/icon), never crashes. If implementation-time judgment prefers a tighter bound, dropping `achievementSchema` to 24 h (matching `achievementGlobal`) retains most of the win — the implementer may choose 24 h without a plan change; 7 d is the default.

**Per-task rollback:**
- **T1:** roll back with a follow-up migration dropping the column (never edit the merged migration). Nullable + unread-by-anything-until-T3 → safe to leave in place too.
- **T2:** revert the `game-store.ts` diff; column simply stays null. No data cleanup needed.
- **T3:** revert `multiplayer.ts` to the live-fetch implementation (self-contained file, single caller) — behavior returns to HEAD exactly.
- **T4:** revert the two TTL-key references; keys in `ttl.ts` are inert if unused.
- Tasks are independently revertible in reverse order; no cross-task data coupling (the column is pure derived reference data, rebuildable by one job run).

---

## Required docs/ updates

Per the repo Documentation Rule (schema/repository/job changes → docs updated in the same change):

- **`docs/DATA_MODEL.md`** — document `Game.categoryIds` (JSON number array, nightly-refreshed, null = never categorized) alongside the existing genres/price precompute columns (T1/T2).
- **`docs/BACKEND.md`** — update the nightly-job description (`refreshGameStoreData` now persists categories too) and the multiplayer repository description (DB-read, zero request-path Store calls); note the two new TTL keys and their rationale (T2/T3/T4).
- **`docs/ERROR.md`** — new ERR-XXXX entry (ERR-0010/0011 template): root cause = "multiplayer filter recomputed slow-changing Store reference data live on the request path"; generalized rule = "any per-game external field consumed library-wide on a request path must be persisted by the nightly job and read from the DB — the ERR-0010/0011 precompute rule, now closing its own 'where else' note that named multiplayer"; before/after numbers from the measurement plan; index table updated, nothing deleted.
- **`docs/STEAM_DATA_SOURCES.md`** — multiplayer categorization row moves from "live Store API" to "derived from nightly-persisted Store metadata", fallback ladder note for the null/uncategorized state.
- **`docs/ARCHITECTURE.md`** — only if it enumerates the precompute columns (check at implementation time); otherwise no change.
- **No changes** to `docs/API.md` (no public JSON surface touched) or `docs/FRONTEND.md` (no client change).

---

## Review record

Status: round 1 adversarial review received and addressed.

### Unresolved objections

None. All five reviewer objections (one blocking, four non-blocking) were folded into the plan body rather than deferred.

### Revision history

- **Round 1:**
  - Fixed Affected files test paths: replaced nonexistent `tests/server/repositories/{game-store,multiplayer,achievements}.test.ts` with the verified real files `tests/unit/game-store.test.ts`, `tests/integration/multiplayer-repo.test.ts`, `tests/unit/achievements-repo.test.ts` (confirmed via `find tests`; no `tests/server/` tree exists), removing the "to be confirmed by the implementer" deferral — the two sections now agree. (Blocking.)
  - Added T4 staleness risk to Risk & rollback: 7 d `achievementSchema` TTL creates an up-to-7-day window for new-DLC achievement names/icons on a warm instance (previously ≤1 h); justified against schema volatility and cold-start bounds, with an explicit 24 h fallback the implementer may take.
  - Added cross-theme co-edit note to the TTL invariant row: Theme 1 also edits the frozen TTL object literal (`insightsAggregate`); keys disjoint, second-lander rebases.
  - Recategorized bug-5 in the regression-surface table from "untouched surfaces / risk: none" to the shared-`game-store.ts`, genres-write-guarded bucket alongside bug-3.
  - Reworded the TDD intro to exempt test #3 (green-throughout regression tripwire) from the red-first claim.
  - Corrected the STEAM-1 mechanism and measurement prose: the post-fix path is one DB read **plus the retained `getProfile` call** (expected cache hit from earlier in the same page render), not literally a single DB read; <100 ms target and O(1)-in-external-calls claim unchanged.
