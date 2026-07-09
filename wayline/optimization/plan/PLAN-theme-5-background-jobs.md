# PLAN — Theme 5: Background jobs (onboarding wall and nightly window)

**Theme:** 5 — Background jobs: first-login onboarding backfill + nightly snapshot window
**Branch** `altan/optimization` · investigation HEAD `13023e3` · 2026-07-09
**Status: REVISED — round-1 adversarial review addressed (see Review record)**

Sources of record: `wayline/optimization/investigation/theme-5-background-jobs.md` (scout),
`wayline/optimization/verification/theme-5-background-jobs.evidence.md` (receipt — authoritative on
verdicts/corrections), `wayline/optimization/investigation/SUMMARY.md` (dependency notes). All
file:line anchors below re-verified at HEAD this planning run.

---

## Root causes addressed

| ID | Verdict | Justification / gated check |
|---|---|---|
| STEAM-8 / COMP-5 | **CONFIRMED (structural)** | First-login backfill: 3N serial upserts in ONE `$transaction` (`server/jobs/onboarding-backfill.ts:101-177`) plus trailing **unbounded** `recordAchievementUnlocks` (`:185`, `achievementUnlockLimit` undefined on first login), awaited in the `/onboarding` RSC (`app/onboarding/page.tsx:50`) with **no `maxDuration`** (`:22` sets only `force-dynamic`). Receipt corrections honored: it streams behind `<Suspense>` (skeleton at `:115-117` — failure mode is **stream truncation → partial data**, not a frozen page), and the `force` resync path is ALREADY bounded (top-20 via `app/settings/actions.ts:24,77` → `server/repositories/account.ts:79-84`) under `maxDuration = 60` (`app/settings/page.tsx:29`). Only the first-login path is unbounded AND uncapped. Absolute seconds gated on `n-games`/`M` and `db-rtt` checks. |
| STEAM-7 / COMP-6 | **PLAUSIBLE — planned with justification** | Nightly `recordAchievementUnlocks` (`server/jobs/snapshot.ts:153` passes no limit; `:349` `candidates = all`) is an unbounded serial fan-out on the SHARED `steamLimiter`, up to 3 `acquire()`/game cold (`achievements.ts:207,274,312`), ≈75 s @ M=100. Mechanism CONFIRMED verbatim in the receipt; truncation risk gated on real `M` + platform timeout tier (gated checks `db-rowcount`, `platform-tier`, `jobrun` — **preserved below**). **Justification for planning despite PLAUSIBLE:** per SUMMARY dependency note, this call is the SHARED TAIL of both the nightly job and first-login onboarding — bounding it once fixes both. This plan produces exactly ONE fix for the shared tail (T1), which T2 (onboarding) merely parameterizes. |

### Folded / excluded

| ID | Disposition | Reason |
|---|---|---|
| STEAM-6 | **Gated check / cheap sequencing only — deferred hazard is JOB-WINDOW consumption** | 2N cold `storeLimiter` acquisitions (price pass `library-value.ts:80` + metadata pass `game-store.ts:39-48`) run sequentially after the achievement work **in the same per-user job window**. The CONFIRMED hazard here is job-window consumption/truncation — the receipt ranks STEAM-6 co-dominant on wall-clock (~150 s+/user) and states the separate `storeLimiter` bucket "does nothing for job wall-clock" (evidence :116; investigation :189-191). The store passes remain 2N (library-linear) after T1–T3: **this plan does NOT bound them; it defers the fold, and the plan's primary window metric is explicitly contingent on that deferral resolving** (see Measurement plan). Deferral rationale: pass-folding (single appdetails call for metadata+price) is a store-client refactor whose payoff and urgency are unproven until real `N` + platform tier are measured — T3's per-pass timing (`libraryValueMs`, `gameStoreMs`) exists precisely to promote or dismiss the fold on data (`jobrun-timing` gate). On a 60 s (Hobby) tier the ~75 s store subtotal alone still truncates the job even after T1 — in that case the fold (or user-loop chunking) is promoted from deferred to required before Theme 5 can claim its window metric. |
| STEAM-4 (limiter partitioning) | **Out of lane — explicitly deferred** | A Theme-2 finding. This plan does NOT partition the limiter; per the binding cross-theme note, limiter partitioning scope is a Phase 6 decision. Stated as a dependency, not decided here. |
| Durable cache backend (bug-3 lane) | **Out of lane — dependency only** | "Always cold at 03:00" is a consequence of the in-process Map (`server/cache.ts:32`). Any durable-cache decision belongs to bug-3's fix lane; this plan's bounding works regardless and only gets *better* if that lane ships. |
| STEAM-1/2/3/5/9, DATA-*, RSC-*, FE-*, COMP-7/8 | **Other themes** | Owned by Themes 1–4 plans. Noted only where sequencing interacts (see Measurement plan — Theme 3 shell fix confounds LCP measurements, not job-window measurements, so Theme 5 is measurable independently). |

---

## Chosen fix

Two mechanisms, one shared tail.

### Mechanism A — bound the shared tail once (`recordAchievementUnlocks`)

Root cause: when `limit` is `undefined`, `candidates = all` achievement-bearing games
(`snapshot.ts:349`) and the serial `for … await` loop pays up to 3 `steamLimiter.acquire()` per
cold game — cost grows linearly and unboundedly with library size, inside a window that is
hard-capped by the platform, with silent truncation as the failure mode.

Fix: **remove the unbounded code path entirely.** `recordAchievementUnlocks` gains an internal
nightly budget and a **deterministic day-keyed rotating window** so that full coverage is
preserved *across* nights instead of demanded *within* one night:

1. New exported const `ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT` (proposed 40; final value is set after
   the `db-rowcount`/`platform-tier` gated checks land — it must satisfy
   `(20 + LIMIT) × 3 × 250 ms ≪ effective timeout` with margin for the store passes).
2. When `limit` is explicitly passed (resync path), behavior is byte-identical to today: top-N
   by playtime. **No change to the bounded resync path** (bug-04-adjacent, must not regress).
3. When `limit` is omitted (nightly + onboarding-without-limit today), candidates become the
   union of:
   - **hot set:** top-20 by `playtimeTwoWeeks` (falling back to `playtime.total`) — games where
     NEW unlocks actually happen get recorded every night, so recent activity is never delayed.
     Cost note (conservative): pass 1 (`snapshotAchievements`) warms top-20 by TOTAL playtime
     (`snapshot.ts:274` via `topGamesByPlaytime`), while the hot set sorts by TWO-WEEK playtime —
     the two sets *may* overlap heavily (cheap marginal cost) but can be largely disjoint for a
     user whose recent activity differs from all-time favorites, in which case the hot set costs
     a near-full `20 × 3 × 250 ms` cold. The bound formula below already assumes the worst case,
     so no claim of "low marginal cost" is load-bearing. The hot-set sort requires a **new**
     pure sort-by-two-week helper — do NOT reuse `topGamesByPlaytime` (`lib/games/select.ts`),
     which sorts by total playtime only;
   - **rotation window:** sort remaining achievement games deterministically by `appId`, split
     into `ceil(R / ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT)` windows, pick window
     `dayOfYear(utcDayKey()) mod windowCount`. Stateless (no new column, **no migration**),
     idempotent (re-running the same day picks the same window; upserts are no-ops), and gives
     guaranteed full-library coverage every `ceil(R/LIMIT)` nights.

Why this removes the root cause and not the symptom — **for the achievement portion of the job
only**: the per-invocation limiter cost of `recordAchievementUnlocks` becomes a **constant**
(`≤ (20 + LIMIT) × 3` acquires) independent of library size, so the *achievement tail* can no
longer outgrow the platform window as libraries grow. This claim does NOT extend to the whole
job: the STEAM-6 store passes remain 2N (library-linear) in the same sequential per-user window
and are only deferred here (see the STEAM-6 row and Measurement plan — on a 60 s tier the ~75 s
store subtotal alone still truncates the job after T1). Completeness is converted
from "one unbounded night" (which truncates and loses data non-deterministically) into "bounded
nights that provably converge" (which never truncates and loses nothing — `unlockedAt` is Steam's
real timestamp, so late recording yields identical rows).

**Acceptance-criterion #6 reconciliation (shipped semantics change — explicit, not silent):**
issue #91 criterion #6 ("records unlock events for ALL achievement games") shipped with
*single-run* semantics: one nightly (or first-login) run covers every achievement game, and both
the existing test `tests/unit/snapshot-achievement-unlocks.test.ts:65-87` and the in-code
docstring at `server/jobs/snapshot.ts:327-339` ("Recording EVERY such game … is what makes
criterion #6 hold") pin that interpretation. T1 deliberately **weakens #6 from single-run
completeness to eventual completeness**: every achievement game is covered within one rotation
cycle (`ceil(R/LIMIT)` nights), never dropped. Because bug-2 (Year-in-Review) reads
`AchievementUnlock`, this reinterpretation is regression-sensitive and is handled in the open:
the `:65-87` test is UPDATED (not left green by fixture luck — see T1), the `snapshot.ts:327-339`
docstring is rewritten to state the budgeted/rotational contract (see Required docs/ updates),
and `docs/ACCEPTANCE.md` gets a companion note on #6's revised "eventual completeness" wording,
including the first-login consequence: a fresh user's Year-in-Review is incomplete for up to
`ceil(R/LIMIT)` nights (previously all existing unlocks were populated immediately,
`snapshot.ts:334-339`).

Degrade-never-fabricate: nothing is fabricated — unlock rows simply appear over subsequent
nights; the reading surfaces (Year-in-Review) already render whatever rows exist, and the
`{ available: false }` ladder is untouched (per-game unavailability short-circuit at
`server/repositories/achievements.ts:64-66` remains).

### Mechanism B — cap the onboarding invocation and its function window

Root cause: `/onboarding` awaits the backfill in an RSC with no `maxDuration`, and the backfill
inherits the unbounded tail. Fix:

1. `runOnboardingBackfill` passes an explicit first-login bound —
   `ONBOARDING_UNLOCK_LIMIT = 20`, same value and same code path as the already-shipped resync
   bound — when the caller supplies none. (After Mechanism A the omitted-limit path is bounded
   anyway; the explicit onboarding cap makes first login *smaller* than the nightly budget,
   because the user is waiting on the stream. The nightly rotation completes the historical
   backfill over the following nights.)
2. `export const maxDuration = 60` on `app/onboarding/page.tsx` — mirrors the shipped
   `app/settings/page.tsx:29` pattern (60 = Hobby max, safe on every tier; raising it is the
   **platform-tier gated decision**, stated as a dependency, not decided here).
3. Worst-case first-login stream cost drops from `~M × 3 × 250 ms` (unbounded, ~75 s @ M=100) to
   `≤ 20 × 3 × 250 ms ≈ 15 s` of achievement work + profile fetch + 3N DB writes — inside a 60 s
   window with margin on the Steam side. On truncation-anyway (huge N on slow DB), the
   transaction's all-or-nothing `onboardedAt` stamp (`onboarding-backfill.ts:172-176`) already
   guarantees no partially-onboarded state: the user retries via the designed error state.
4. DB round-trips (the `3N` in one transaction): the `PlaytimeSnapshot` seed loop
   (`:163-170`) is restructured to *read existing keys for today, then `createMany` only the
   missing rows* — one round-trip instead of N, dialect-safe (plain `createMany` works on SQLite;
   only `skipDuplicates` doesn't — ERR-0005), idempotent via the pre-filter with the
   `(steamId, appId, date)` compound unique as backstop. `Game`/`OwnedGame` upserts (reference
   tables, genuinely upserted) stay per-row — that is the upsert convention, and the receipt's
   `db-rtt` gated check decides whether further batching is warranted (kept as gated scope, T4).

### Mechanism C — make the nightly window intentional (STEAM-6 cheap sequencing)

`app/api/cron/snapshot/route.ts` gets an explicit `export const maxDuration` (proposed 300,
**value gated on the `platform-tier` check** — if the project is Hobby-tier the correct value is
60 and the multi-user loop needs the Phase 6 chunking conversation; that decision is a stated
dependency). `runSnapshotForUser` gains per-pass wall-clock timing recorded into the existing
`JobRun.payload` — this converts every gated check (`jobrun`, `jobrun-timing`, real `M`/`N`) into
data the next cron run produces for free, and is the precondition for deciding the deferred
STEAM-6 pass-folding.

### Rejected alternatives

1. **Fire-and-forget / queue the onboarding tail off the request (background task, `waitUntil`,
   or a queue).** Rejected: Vercel serverless has no durable in-process background work —
   `waitUntil` still counts against the same invocation window, and a real queue is new
   infrastructure (out of this optimization lane, overlaps the bug-3 durable-backend decision).
   The bounded-seed + nightly-rotation design achieves the same UX (fast first login, eventual
   completeness) with zero new infrastructure and no divergence from the nightly fix.
2. **Persist a per-game `achievementsSyncedAt` cursor column for resumable catch-up.** Rejected:
   requires a migration (this plan proposes none — constraint #6; Theme 1's receipt establishes
   the no-new-schema bar), and the stateless day-keyed rotation achieves equivalent convergence
   with strictly less machinery. Revisit only if the gated `db-rowcount` check reveals `M` so
   large that rotation convergence (`ceil(R/LIMIT)` nights) is unacceptable.
3. **Parallelize the fan-out with `Promise.all` / raise the limiter budget.** Rejected:
   `Promise.all` still serializes at the capacity-1 `steamLimiter` (proven at
   `library-value.ts:80` / receipt line for `store-client.ts:150`), and raising the shared
   bucket's rate trades job speed for request-path contention (STEAM-4) — exactly the wrong
   direction, and limiter scope is explicitly deferred to Phase 6.

---

## Invariants compliance

| Invariant | How respected |
|---|---|
| TTLs only in `server/cache/ttl.ts` | No TTL is added or changed. New constants (`ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT`, `ONBOARDING_UNLOCK_LIMIT`) are fan-out bounds, not TTLs, colocated with the existing `ACHIEVEMENT_SNAPSHOT_LIMIT` (`snapshot.ts:26`) / `ACHIEVEMENT_RESYNC_LIMIT` (`app/settings/actions.ts:24`) pattern. |
| `withErrorBoundary` owns error mapping | The cron route keeps its existing dedicated auth + try/catch (documented exception, `route.ts:1-17`); no new try/catch added to any handler. `maxDuration` is a config export, not error handling. |
| Zod at every I/O boundary | No new I/O boundary. All Steam calls remain behind the existing Zod-parsed `lib/steam` clients; no coercion added. |
| Degrade, never crash or fabricate | Partial backfill degrades by *delay*, never by fabrication: unlock rows carry Steam's real `unlockedAt`; unavailability short-circuit (`achievements.ts:64-66`) and `{ onboarded:false, reason }` results (`onboarding-backfill.ts:87-91`) unchanged. No silent zeros: the `createMany` seed pre-filters existing keys so `rowsInserted`-style semantics stay truthful. |
| `steamId` is a string | All touched signatures already take `steamId: string`; unchanged. |
| Migrations immutable / none proposed | **Zero migrations.** The rotation cursor is stateless by design (rejected alternative #2). |
| Cron auth + idempotency | `x-cron-secret`/Bearer `timingSafeEqual` auth untouched (`route.ts:27-53`). Idempotency strengthened: same-day re-run picks the same rotation window; all writes remain compound-key upserts or pre-filtered `createMany` with the `(steamId, appId, date)` unique as backstop. |
| `playtimeForever` monotonic | Clamp logic (`clampPlaytime`, `snapshot.ts:75-81`; onboarding `:164`) untouched by every task; T4's seed batching keeps the `clampPlaytime(x, 0)` call per game before insert. |
| RSC/Suspense/skeleton geometry | `/onboarding` keeps its existing skeleton + Suspense boundary (`page.tsx:31-47,115-117`); only a `maxDuration` export is added — no layout/geometry change, no CLS impact. |
| Perf budget (<200 KB JS / LCP) | Server-only changes; zero client JS added. |
| API key server-only / CSP | Untouched. |

---

## Task breakdown

### T1 — Bound the shared tail: nightly budget + day-keyed rotation in `recordAchievementUnlocks`
**Scope (in):** `server/jobs/snapshot.ts` (function `recordAchievementUnlocks`, new const
`ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT`, TWO small pure helpers exported for tests: (a) window
selection, (b) a **new sort-by-two-week-playtime helper for the hot set** — distinct from and not
replacing `topGamesByPlaytime` in `lib/games/select.ts`, which sorts by total playtime only and
must keep serving the explicit-`limit` resync branch; rewrite of the `:327-339` docstring to the
budgeted/rotational contract); `tests/unit/snapshot-achievement-unlocks.test.ts` — **including
updating the existing behavior pin at `:65-87`** (see acceptance criteria).
**Scope (out):** onboarding files, cron route, limiter, repositories, any `lib/steam` file, the
explicit-`limit` (resync) branch.

**Acceptance criteria**
- With `limit` explicitly passed, candidate selection is byte-identical to HEAD (top-N by
  playtime) — existing resync tests pass unmodified.
- With `limit` omitted and `A` achievement games, per-invocation candidates ≤
  `20 + ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT`, and the hot set (top-20 by two-week playtime) is
  always included.
- Window selection is a pure function of `(sorted appIds, utcDayKey())`: same day ⇒ same window
  (idempotent re-run); consecutive days ⇒ successive windows; every appId appears in exactly one
  window per cycle (full coverage in `ceil(R/LIMIT)` days — asserted by iterating windowCount
  simulated days and unioning).
- Per-game failure isolation (`:352-364` try/catch) and unavailable-game skip unchanged.
- **The existing test at `tests/unit/snapshot-achievement-unlocks.test.ts:65-87`** ("records
  unlock events for ALL achievement games, incl. one outside the top-played set (#6)") is
  **rewritten**, not left as-is: its 2-game fixture would stay green under T1 only by luck
  (2 ≤ 20 hot set) while no longer verifying its stated single-run intent. It becomes an
  eventual-completeness assertion — full coverage of every achievement game over one simulated
  rotation cycle (`ceil(R/LIMIT)` consecutive day-keys), with the low-playtime game covered by
  some night in the cycle — and its title/comment updated to cite the revised #6 semantics.
- Docstring at `snapshot.ts:327-339` no longer claims single-run completeness; it states the
  hot-set + rotation contract and the convergence horizon.
- `pnpm typecheck && pnpm lint && pnpm test tests/unit/snapshot-achievement-unlocks.test.ts` green.

### T2 — Onboarding: explicit first-login bound + `maxDuration` on `/onboarding`
**Depends on:** T1 (uses the same single shared-tail mechanism; T2 only parameterizes it).
**Scope (in):** `server/jobs/onboarding-backfill.ts` (default `achievementUnlockLimit` to
`ONBOARDING_UNLOCK_LIMIT = 20` when caller passes none), `app/onboarding/page.tsx`
(`export const maxDuration = 60` + comment mirroring `app/settings/page.tsx:29`),
`tests/unit/onboarding-backfill.test.ts`.
**Scope (out):** resync path (`app/settings/actions.ts`, `server/repositories/account.ts` — must
remain byte-identical), Suspense/skeleton markup, auth/redirect logic, transaction structure
(that is T4).

**Acceptance criteria**
- First-login path (`runOnboardingBackfill(id)` with no opts) calls
  `recordAchievementUnlocks(id, games, 20)` — asserted via spy.
- Resync path (`opts = { force:true, achievementUnlockLimit: 20 }`) behavior unchanged — existing
  tests pass unmodified.
- `app/onboarding/page.tsx` exports `maxDuration = 60`; skeleton/Suspense JSX unchanged (snapshot
  or structural assertion).
- Private-profile and transient-error degradation results (`{ onboarded:false, reason }`)
  unchanged.
- Full suite green.

### T3 — Nightly window made intentional: cron `maxDuration` + per-pass timing in `JobRun.payload`
**Scope (in):** `app/api/cron/snapshot/route.ts` (add `export const maxDuration` with a comment
naming the platform-tier dependency — provisional value 300, drop to 60 if the `platform-tier`
gated check reports Hobby), `server/jobs/snapshot.ts` (`runSnapshotForUser` records
`timings: { playtimeMs, achievementSnapshotMs, unlockRecordingMs, libraryValueMs, gameStoreMs }`
per user into `SnapshotResult`, surfaced through `SnapshotBatchResult` → `JobRun.payload`),
`tests/unit/snapshot-job.test.ts`, `tests/integration/snapshot.test.ts` (payload shape).
**Scope (out):** auth logic, response shape beyond additive `timings`, store repositories
(pass-folding is deferred), user-loop chunking (Phase 6).

**Acceptance criteria**
- Cron auth tests pass unmodified (Bearer + `x-cron-secret`, 401 paths).
- `JobRun.payload` parses to the batch result including per-user `timings` with all five keys as
  non-negative numbers; top-level summed keys unchanged (backward compat, `snapshot.ts:44-61`).
- Implementation nuance: each pass's timing is captured in a `finally` block — the passes at
  `snapshot.ts:152-169` are best-effort inside try/catch, and a throwing pass must still record
  its elapsed time, or the "five non-negative duration keys per user" criterion above breaks on
  the first pass failure.
- Additive-only: existing consumers of `SnapshotBatchResult` compile without change.
- The route exports `maxDuration` and its comment cites gated check #4 (platform tier).
- Full suite green.

### T4 — (Gated) Onboarding DB seed batching: pre-filtered `createMany` for `PlaytimeSnapshot`
**Gate:** proceed only if the `db-rtt` check (deployed DB = Postgres-over-network, RTT ≥ ~2 ms)
confirms the 3N loop is material; on SQLite-class RTT this task is skipped (receipt: sub-second,
fan-out dominates regardless).
**Scope (in):** `server/jobs/onboarding-backfill.ts` (`:163-170` loop → read existing
`(appId)` keys for `(steamId, dayKey)`, `createMany` the missing rows with `clampPlaytime(x, 0)`
applied, inside the same `$transaction`), `tests/unit/onboarding-backfill.test.ts`.
**Scope (out):** `Game`/`OwnedGame` upsert loops (reference-table upsert convention stands),
transaction boundary and `onboardedAt` stamp ordering, `skipDuplicates` (ERR-0005 — not used).

**Acceptance criteria**
- Re-running backfill the same day inserts zero new snapshot rows (pre-filter proven by test with
  pre-existing rows).
- Rows created carry `clampPlaytime(value, 0)` semantics identical to HEAD.
- Works on SQLite (test env) — no `skipDuplicates` usage.
- `onboardedAt` still commits only if all writes succeed (transaction failure test).
- Full suite green.

Ordering: T1 → T2 → T3 → T4(gated). T1/T3 touch `server/jobs/snapshot.ts` in disjoint regions but
are sequenced to avoid merge noise.

---

## TDD test plan (failing first)

| # | File · test name | Red→green assertion |
|---|---|---|
| 1 | `tests/unit/snapshot-achievement-unlocks.test.ts` · `"nightly path (no limit) processes at most hotSet + ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT games"` | Mock `getGameAchievements`; feed 120 achievement games; call `recordAchievementUnlocks(id, games)`; RED: 120 calls (unbounded). GREEN: ≤ 20 + LIMIT calls. |
| 2 | `tests/unit/snapshot-achievement-unlocks.test.ts` · `"nightly hot set always includes top-20 by two-week playtime"` | Game with max `playtimeTwoWeeks` but low total is in tonight's candidates regardless of rotation window. RED: fails (today all games / no hot-set concept). GREEN: passes. |
| 3 | `tests/unit/snapshot-achievement-unlocks.test.ts` · `"rotation windows cover every achievement game exactly once per cycle and are stable within a day"` | Pure window helper: union over `windowCount` consecutive simulated days = full set, no duplicates within a cycle; two calls with the same `dayKey` return the same window. RED: helper does not exist. GREEN: passes. |
| 4 | `tests/unit/snapshot-achievement-unlocks.test.ts` · `"explicit limit path unchanged: top-N by playtime"` | Regression pin for resync (bug-04-adjacent): `limit=20` selects exactly `topGamesByPlaytime(all, 20)`. Written first as a characterization test (green at RED stage — a pin, must stay green). |
| 4b | `tests/unit/snapshot-achievement-unlocks.test.ts:65-87` (EXISTING test, rewritten) · `"criterion #6: every achievement game (incl. low-playtime) is covered within one rotation cycle"` | The shipped pin asserts a playtime=1 game is recorded in a SINGLE no-limit run — under T1 it stays green only because its 2-game fixture fits the hot set, no longer testing its intent. Rewrite: ≥ `20 + LIMIT + 1` games, iterate `windowCount` consecutive simulated day-keys, assert the low-playtime game (and every game) is recorded by cycle end and NOT necessarily on night 1. RED against intent at HEAD semantics; GREEN under rotation. |
| 5 | `tests/unit/onboarding-backfill.test.ts` · `"first login passes ONBOARDING_UNLOCK_LIMIT to recordAchievementUnlocks"` | Spy on `recordAchievementUnlocks`; `runOnboardingBackfill(id)`; RED: third arg `undefined`. GREEN: `20`. |
| 6 | `tests/unit/onboarding-backfill.test.ts` · `"resync opts pass through unchanged"` | Characterization pin: `{force:true, achievementUnlockLimit:20}` forwarded verbatim (stays green). |
| 7 | `tests/unit/snapshot-job.test.ts` · `"SnapshotResult includes per-pass timings and batch payload preserves summed keys"` | RED: `timings` absent. GREEN: five non-negative duration keys per user; summed top-level keys equal HEAD semantics. |
| 8 | `tests/integration/snapshot.test.ts` · `"JobRun.payload round-trips timings"` | RED: parse fails to find `results[0].timings`. GREEN: present after a real `runSnapshot()` against the test DB. |
| 9 | (T4, gated) `tests/unit/onboarding-backfill.test.ts` · `"snapshot seed uses one createMany and skips existing rows"` | Pre-insert one row for today; RED: N upsert calls observed; GREEN: one `findMany` + one `createMany` with N−1 rows, no `skipDuplicates` option. |
| 10 | (route pin) `tests/integration/snapshot.test.ts` or route test · `"cron auth unchanged"` | Characterization pins for Bearer/x-cron-secret 200/401 — must never go red across T3. |

---

## Affected files

Verified at HEAD this run (all paths absolute from repo root `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/`):

**Modified by tasks**
- `server/jobs/snapshot.ts` — T1 (`recordAchievementUnlocks` at `:341-367`, new consts/helper near `:26`), T3 (`runSnapshotForUser` `:89-180`, `SnapshotResult`/`SnapshotBatchResult` `:28-61`).
- `server/jobs/onboarding-backfill.ts` — T2 (default limit at `:185` call site / `:50` opts), T4 (seed loop `:163-170`).
- `app/onboarding/page.tsx` — T2 (`maxDuration` export beside `:22`).
- `app/api/cron/snapshot/route.ts` — T3 (`maxDuration` export beside `:24`).
- `tests/unit/snapshot-achievement-unlocks.test.ts` — T1 (adds tests #1-3 AND rewrites the existing criterion-#6 pin at `:65-87`; not purely additive).
- `tests/unit/onboarding-backfill.test.ts` — T2, T4.
- `tests/unit/snapshot-job.test.ts` — T3.
- `tests/integration/snapshot.test.ts` — T3 (payload shape), auth pins.

**Read-only context (must NOT change)**
- `app/settings/actions.ts` (`ACHIEVEMENT_RESYNC_LIMIT` `:24`, `resyncNow` `:70-82`) — resync bound stays.
- `app/settings/page.tsx` (`maxDuration = 60` `:29`) — pattern mirrored, file untouched.
- `server/repositories/account.ts` (`resyncAccount` `:79-84`) — untouched.
- `server/repositories/achievements.ts` (`getGameAchievements`, short-circuit `:64-66`) — untouched.
- `lib/steam/limiter.ts`, `lib/steam/achievements.ts`, `lib/steam/store-client.ts` — untouched (limiter scope deferred to Phase 6).
- `server/repositories/library-value.ts`, `server/repositories/game-store.ts` — untouched (STEAM-6 pass-folding deferred, gated).
- `lib/games/select.ts` (`topGamesByPlaytime`) — reused, untouched.
- `vercel.json` — cron schedule unchanged.

**Docs (see §Required docs/ updates)**
- `docs/BACKEND.md`, `docs/ERROR.md`, `docs/DEPLOYMENT.md`, `docs/FRONTEND.md` (one line, `/onboarding` `maxDuration`), `docs/ACCEPTANCE.md` (criterion-#6 companion note), plus the in-code docstring `server/jobs/snapshot.ts:327-339`.

---

## Measurement plan

**Before/after metric (primary):** nightly per-user job wall-clock and per-pass split, read from
`JobRun.payload.results[*].timings` (created by T3). Success is split honestly in two:
- **Unconditional (T1's own metric):** `unlockRecordingMs` bounded to
  `≤ (20 + LIMIT) × 3 × 250 ms` regardless of library size.
- **Contingent (whole-window metric):** total per-user wall-clock fits the declared
  `maxDuration` with ≥ 25% margin — **explicitly contingent on BOTH (a) the `platform-tier`
  check confirming the 300 s tier AND (b) the deferred STEAM-6 store-pass fold** (the 2N store
  passes remain library-linear after T1–T3; on a 60 s tier the ~75 s store subtotal alone
  truncates the job, so this metric is unmeetable by T1–T3 there and the fold is promoted to
  required — see the STEAM-6 row).

Recorded in `wayline/optimization/plan/measurements/theme-5.md`. **Before-number source:** the
pre-existing `JobRun` rows via the `jobrun` gated SQL check (status + wall-clock at HEAD
behavior). Task ordering is strictly T1 → T2 → T3, so T3's instrumentation can never observe the
unbounded "before" — do not reorder T3 ahead of T1 for measurement's sake; the SQL check is the
before-lane.

**Onboarding metric:** wall-clock of `runOnboardingBackfill` on a fresh test user (staging or
local with prod-shaped library), before (unbounded tail) vs after (bounded seed). Success = first
login completes well inside 60 s and `onboardedAt` commits; target ≤ ~20 s at M=100.

**Convergence metric (new, owed by the rotation design):** nights until full unlock coverage for
a fresh user = `ceil(R/LIMIT)`; verify via `AchievementUnlock` distinct-appId count growing to
`M` across simulated consecutive-day runs (unit-level, test #3) and one real multi-night observation.

**Gated checks preserved from the receipt (human live lane — these gate final constant values and T4):**
1. `db-rowcount` / real `M`: `SELECT COUNT(*) …` on `OwnedGame`⋈`Game.hasStats` for the featured `STEAM_ID` — sets `ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT` and convergence horizon.
2. `platform-tier` (gated check #4 in SUMMARY): Vercel effective function timeout for `/api/cron/snapshot` and `/onboarding` — sets the cron `maxDuration` value (300 vs 60) and whether Phase 6 needs user-loop chunking. **A stated dependency, not guessed.**
3. `jobrun` / `jobrun-timing`: last-5 `JobRun` status + wall-clock (pre-T3 via SQL, post-T3 via payload) — decides whether the deferred STEAM-6 pass-folding is promoted to a task.
4. Real library `N` + deployed DB RTT (`db-rtt`) — gates T4.
5. `ENABLE_STEAMSPY` prod value — not Theme-5 scope, but recorded here because the nightly window math shares the platform-tier answer (bug-3 carryover; no Theme-5 action).

**Confounding note (SUMMARY sequencing):** Theme 3's shell fix confounds *LCP/page* measurements,
not job-window measurements — Theme 5's metrics come from `JobRun.payload` and function-duration
traces, so they are measurable independently of Theme 3's landing order. Onboarding stream-completion
timing should still be measured after Theme 3 lands if an LCP-style number is wanted.

---

## Risk & rollback

**Regression surface vs the 5 shipped bug fixes**
- **bug-1 history-no-data / bug-2 year-in-review-zero-hours:** both read `PlaytimeSnapshot`/`AchievementUnlock` written by these jobs. Risk: rotation delays unlock rows for cold games → Year-in-Review shows *fewer* unlocks for up to `ceil(R/LIMIT)` nights after a fresh onboarding. Mitigation: rows are delayed-not-lost with true `unlockedAt` (no fabrication, no zeros); hot set covers active games nightly; convergence test pins the horizon. Playtime snapshot writes (bug-1/2's substrate) are untouched by T1–T3; T4 preserves clamp + idempotency under test.
- **bug-3 insights-slow:** no cache/TTL/store-repository changes here; the deferred STEAM-6 fold explicitly stays in the gated lane so it cannot collide with bug-3's durable-cache decision.
- **bug-4 obs-software-title (onboarding-adjacent):** the resync path (`app/settings/*`, `resyncAccount`) is declared out-of-scope and pinned by characterization tests #4/#6; `maxDuration=60` on settings untouched.
- **bug-5 insights-unknown-label:** reads `Game.genres` written by `refreshGameStoreData` — untouched.

**Other risks**
- Rotation math bug (skipped/duplicated window) → some games never recorded. Mitigated by pure-function extraction + coverage test #3.
- `timings` payload growth: additive JSON in `JobRun.payload`; bounded (5 numbers/user).
- Wrong `maxDuration` guess on a Hobby project (300 rejected by platform) → build-time/config error, caught in preview deploy; value is gated, comment documents the dependency.

**Per-task rollback**
- T1: revert the `snapshot.ts` hunk — the omitted-limit path returns to `candidates = all`. No data cleanup (all writes idempotent upserts).
- T2: revert default-limit + `maxDuration` export — onboarding returns to unbounded tail. No data impact.
- T3: revert `maxDuration` + timings — `JobRun.payload` returns to the prior shape (readers must therefore treat `timings` as optional, enforced in T3's types).
- T4: revert to the per-row upsert loop — identical rows either way (same key, same clamp).
Each task is one commit (`fix:`/`refactor:` Conventional Commits) → single-commit `git revert`.

---

## Required docs/ updates

Per the repo Documentation Rule (jobs are `server/` core paths):
- **docs/BACKEND.md** — jobs section: document the nightly unlock budget + day-keyed rotation (constants, convergence horizon, why the hot set exists), the onboarding first-login bound, the `maxDuration` exports on the cron route and `/onboarding`, and the new `timings` field in `JobRun.payload` (T1–T3).
- **docs/DATA_MODEL.md** — no schema change; add one note to the `AchievementUnlock` section that population is budgeted/rotational (eventual completeness), so readers of the table understand freshness semantics (T1).
- **docs/API.md** — `/api/cron/snapshot` response: additive `results[*].timings` documented (T3).
- **docs/FRONTEND.md** — one line: `/onboarding` carries `maxDuration = 60`, mirroring settings (T2).
- **docs/DEPLOYMENT.md** — note the platform-tier dependency for both `maxDuration` values (gated check #4) (T3).
- **`server/jobs/snapshot.ts:327-339` in-code docstring (T1)** — currently states "Recording
  EVERY such game … is what makes criterion #6 hold" (single-run completeness) and documents that
  first login populates ALL existing unlocks immediately (`:334-339`); both become false under
  T1/T2. Rewrite to the budgeted hot-set + rotation contract, the `ceil(R/LIMIT)` convergence
  horizon, and the first-login `ONBOARDING_UNLOCK_LIMIT` seed.
- **docs/ACCEPTANCE.md** — companion note on issue #91 criterion #6: wording moves from
  single-run to *eventual* completeness (full coverage within one rotation cycle), including the
  onboarding consequence that a fresh user's Year-in-Review is incomplete for up to
  `ceil(R/LIMIT)` nights (a first-impression surface — disclosed, not silent) (T1/T2).
- **docs/ERROR.md** — append a new ERR-XXXX: "unbounded background fan-out in a platform-capped window truncates silently; every job fan-out must carry an explicit per-invocation budget and an explicit `maxDuration`" (class rule generalizing ERR-0003), update the index table, never delete (lands with T1).
- **workstreams / wayline** — this plan file is the Theme-5 record; measurements land in `wayline/optimization/plan/measurements/theme-5.md`.

---

## Review record

**Round 1 (adversarial review) — both blocking findings accepted and folded in; all five
non-blocking objections folded in. No disputes.**

### Unresolved objections

None. All reviewer objections (blocking and non-blocking) were incorporated into the plan body;
nothing was dropped or contested.

### Revision history

- **Round 1:**
  - Restated the Mechanism A truncation-removal claim as applying to the ACHIEVEMENT portion only; added explicit statement that the STEAM-6 2N store passes remain library-linear in the same window after T1–T3.
  - Rewrote the STEAM-6 deferral row: deferred hazard correctly named as job-window consumption/truncation (receipt: co-dominant ~150 s+/user; storeLimiter "does nothing for job wall-clock"), not request-path protection; documented that on a 60 s tier the fold is promoted from deferred to required.
  - Split the primary success metric: unconditional `unlockRecordingMs` bound vs whole-window ≥25%-margin metric now explicitly contingent on BOTH the 300 s platform tier AND the deferred STEAM-6 fold.
  - Added explicit criterion-#6 reconciliation (single-run → eventual completeness) in Mechanism A; T1 now rewrites the existing pin at `tests/unit/snapshot-achievement-unlocks.test.ts:65-87` (new TDD row #4b) instead of leaving it green by fixture luck; `snapshot.ts:327-339` docstring rewrite and a `docs/ACCEPTANCE.md` companion note (incl. first-login incompleteness window) added to Required docs/ updates and T1 scope/acceptance.
  - Softened the hot-set "low marginal cost" claim (total- vs two-week-playtime top-20 sets may be disjoint; worst-case bound is what's load-bearing).
  - T1 scope now names a NEW sort-by-two-week helper, distinct from `topGamesByPlaytime` (total-playtime sort).
  - Measurement plan: before-number sourced from the pre-existing `JobRun` SQL (`jobrun` gated check); dropped the "T3 before T1 if convenient" aside contradicting T1→T2→T3 ordering.
  - T3 acceptance: per-pass timings captured in `finally` blocks so throwing best-effort passes (`snapshot.ts:152-169`) still yield five non-negative keys.
  - Onboarding contract change (first-login no longer populates ALL unlocks immediately) recorded in the reconciliation note and routed to the `docs/ACCEPTANCE.md` update.
