# Plan 04 — Settings "Re-sync now" button spins forever

> Phase-2 fix plan. Worker (Plan, opus, low) → adversarial reviewer (reviewer, opus, xhigh), READ-ONLY.
> **Verdict: `approve` · readyForImplementation = `true`** (round 3 — see retry note).
> Source of truth: [bug-04-settings-resync-stuck.md](bug-04-settings-resync-stuck.md).

| Field | Value |
|---|---|
| Fix classification | **code-fix** (revised down from `mixed`; reviewer confirmed) |
| Effort | **M** |
| Worker confidence | 5/5 |
| Reviewer verdict | approve · ready=true · classOk · testMapOk · redFirstOk · scopeOk · nonNegOk · priorAddressed |
| Rounds to approval | revise → revise → approve (3 rounds; see note) |

## Root cause (recap)

"Spins forever" is **two repo-code/architecture defects** plus one observability-only runtime unknown:
1. **CLIENT:** `ResyncButton.tsx` awaits `resyncNow()` inside `startTransition` with **no try/catch** (`:19-22`); the spinner is bound solely to `isPending` (`:30,:33-38`) and "Synced" is gated on `done` (`:40-44`). When the server function is killed mid-run the awaited promise never settles → `setDone(true)` never runs, `isPending` never clears → the spinner spins forever, **no failure UI at all**.
2. **SERVER/ARCHITECTURE:** `resyncNow` (`actions.ts:67-76`) → `resyncAccount` (`account.ts:79-81`) → `runOnboardingBackfill(steamId,{force:true})` runs, **on the interactive request path**, an **uncapped** per-game achievement-unlock fan-out: `recordAchievementUnlocks` (`snapshot.ts:297-319`) iterates **every** `hasAchievements` game, each paced by the 1-req/250ms limiter (~3 acquires/available game). `snapshot.ts:288-289` states this fan-out must live "never on an interactive request path"; it violates **ERR-0011** (64.8s for 65 games). No `maxDuration` is set anywhere → the platform default timeout kills the function. **Critically, `resyncAccount` (`account.ts:79-81`) is the mandatory forwarding hop** — currently `(steamId: string)` forwarding **no** limit, so any bound is a silent no-op unless threaded through it. A secondary partial-write risk: `onboarding-backfill.ts` commits independent non-transactional writes (`:99,121-157,164-171`) and advances `onboardedAt` (`:187-190`) with no atomic boundary.
3. **RUNTIME-CONFIG (observability rider, NOT the fix):** the exact default timeout is a Vercel-plan fact not readable from code — diagnostic only; even an infinite `maxDuration` leaves the ERR-0011 violation and a multi-minute interactive hang.

## Classification & strategy

**code-fix** (revised from `mixed`). The honest root cause is two repo-code/architecture defects, each fixed
by a code change + red-first test. Neither is caused by absent/private data (not ux-degradation) nor by a
config value (not data-ops-fix as the *primary* cause). `maxDuration` confirmation + the timeout-log lookup
are a **data-ops confirmation rider** for observability — not a code substitute, not load-bearing; the fix
is complete in code even if `maxDuration` is never touched.

**Strategy — obey the codebase's "heavy work bounded, never an uncapped fan-out on the interactive path"
rule, minimum scope:**
1. **Bound the fan-out via an opt-in per-call param.** `recordAchievementUnlocks` gains optional
   `limit?: number`. When provided (resync path), process at most `limit` achievement-bearing games via
   `topGamesByPlaytime` (deterministic, mirroring `ACHIEVEMENT_SNAPSHOT_LIMIT=20` at `:230-233`); the nightly
   reconciler finishes the remainder via idempotent upserts. When **omitted** (nightly call `:153`), behavior
   is **unchanged** — so the existing passing test (`snapshot-achievement-unlocks.test.ts:65-87`) holds verbatim.
2. **Thread the limit through the full chain + make completion atomic.** Limit flows
   `actions.ts (ACHIEVEMENT_RESYNC_LIMIT)` → `resyncAccount(steamId, achievementUnlockLimit)` →
   `runOnboardingBackfill(steamId, { force:true, achievementUnlockLimit })` → `recordAchievementUnlocks(steamId, games, limit)`.
   Independently, wrap the User upsert + Game/OwnedGame loop + snapshot seed loop + the final `onboardedAt`
   update in a **single `prisma.$transaction(async (tx) => …)`** (the mechanism proven at `account.ts:50-61`)
   so `onboardedAt` commits only if every reference write commits; `recordAchievementUnlocks` stays
   outside/after the transaction (best-effort). **No migration.** `resyncNow` returns the `OnboardingResult`
   (not `void`) and still `revalidatePath('/settings')`. Add `export const maxDuration = <ceiling>` to the
   settings segment as a non-load-bearing safety budget.
3. **Client honest states.** `ResyncButton` wraps `resyncNow()` in try/catch so the loading state **always**
   resolves: success → token-styled "Synced"; rejection → designed token-styled error (`aria-live=polite`,
   `text-danger`).

**Dropped this round (reviewer #2/#3): the prior plan's new `/api/resync` offload route.** An awaited
same-origin sub-request holds the action open for the sub-request's full duration, so the same platform
timeout applies — the route is **not** load-bearing for the timeout fix and adds a new auth surface + a
round-trip + a base-URL risk. Bounding the fan-out on the existing direct `resyncAccount()` path fits the
budget with far less scope. **AbortSignal explicitly waived** (distinct upstream-stall failure mode; touches
every shared-client consumer; its own task — the bound + client catch already guarantee the spinner clears).

## Files to change

| File | Edit | Rationale |
|---|---|---|
| `app/settings/ResyncButton.tsx` | Add an `error` state; wrap awaited `resyncNow()` in try/catch (resolve → set `done` from returned status, clear error; reject → set error, clear done). Render a designed token-styled failure message (`text-danger`, `aria-live=polite`). Tokens only. | Defect #1: no client error path → unresolved promise leaves `isPending` stuck. try/catch guarantees the loading state always clears with an honest state. |
| `app/settings/actions.ts` | `resyncNow`: keep session-scoping + unauthenticated throw; call `resyncAccount(sessionUser.steamId, ACHIEVEMENT_RESYNC_LIMIT)` (module const, e.g. 20) — **not** the bare 1-arg call; keep it direct (no offload route); change return `Promise<void>` → `Promise<OnboardingResult>`; still `revalidatePath`. | Defect #2: returning a status lets the client render honestly; passing the limit on the direct call bounds the fan-out. Explicit call form removes the prior wording ambiguity. |
| `server/repositories/account.ts` | `resyncAccount(steamId: string, achievementUnlockLimit?: number)` forwarding `runOnboardingBackfill(steamId, { force:true, achievementUnlockLimit })` (currently forwards no limit). Optional param → `deleteAccountData` & other callers unaffected; update JSDoc. | **The load-bearing forwarding hop** — without it the limit never reaches `recordAchievementUnlocks` and the bound is a silent no-op. |
| `server/jobs/snapshot.ts` *(shared w/ bug-03)* | Add optional `limit?: number` to `recordAchievementUnlocks`: provided → `topGamesByPlaytime(filter(hasAchievements), limit)` (deterministic); omitted → current behavior (ALL games). Preserve per-game try/catch + idempotent upserts. **Do not** change the nightly call site `:153`. | Resolves the cap/reconciler contradiction: cap is opt-in (resync only); nightly stays uncapped, so the existing all-games test passes verbatim. |
| `server/jobs/onboarding-backfill.ts` *(shared w/ bug-03)* | Accept + thread `achievementUnlockLimit` into `recordAchievementUnlocks`. Wrap User upsert (`:99-116`), Game/OwnedGame loop (`:121-157`), snapshot seed loop (`:164-171`), AND the `onboardedAt` update (`:187-190`) in a single `prisma.$transaction(async (tx)=>…)` (as in `account.ts:50-61`). Keep `recordAchievementUnlocks` outside/after the transaction. No migration. | Phase-1-confirmed partial-write risk: writes commit independently and `onboardedAt` runs after them with no atomicity. A `$transaction` callback makes completion all-or-nothing and is the structurally-testable boundary. |
| `app/settings/page.tsx` | Add `export const maxDuration = <plan ceiling>` alongside the existing `dynamic='force-dynamic'` (`:23`) as a safety/observability budget. Not load-bearing (fan-out is bounded in code). | Confines config to the existing settings segment; no new route. |

## Tests (red-first → acceptance criteria)

| Test file | Asserts | Proves AC | Red-first condition (fails today) |
|---|---|---|---|
| `tests/unit/account-settings.test.ts` *(update §4 :305-322)* | `resyncNow` (a) resolves to a non-void `OnboardingResult`, (b) calls `resyncAccount(STEAM_A, <limit>)` (no offload fetch), (c) still throws unauthenticated. | AC1 | Today `resyncNow` is `Promise<void>` (`:67`) calling `resyncAccount(steamId)` with no limit; current test asserts void + single-arg. Asserting non-void + a 2nd limit arg fails. *(Enumerated breaking change to the action contract.)* |
| `tests/unit/resync-button.test.tsx` | Click re-sync: mocked `resyncNow` **rejects** → spinner clears + error message renders; **resolves** `{onboarded:true}` → "Synced" + spinner clears. Loading never persists after settle. | AC2 | Today `ResyncButton` has no catch / no error state (`:19-22,40-44`); a rejecting `resyncNow` renders no failure UI and leaves `done=false` → fails. |
| `tests/unit/snapshot-achievement-unlocks.test.ts` *(new case; keep :65-87 unchanged)* | With N achievement games and `recordAchievementUnlocks(id, games, K)` (K<N): `getGameAchievements` called ≤K times, only top-K-by-playtime processed. | AC3 | Today `recordAchievementUnlocks` takes only `(steamId, games)` and iterates ALL candidates (`:297-319`); a 3rd `limit` arg is ignored → capped-count assertion fails. |
| `tests/unit/onboarding-backfill.test.ts` *(update mockTransaction :41-43)* | **Structural:** spy `prisma.$transaction` — force path invokes it with a callback, and the User/Game/OwnedGame/PlaytimeSnapshot upserts + `user.update(onboardedAt)` all run via the **tx** object (not top-level prisma). | AC4 | Today those writes are independent top-level awaits with **no** `$transaction` (`:99-171,187-190`); asserting `$transaction(callback)` wraps them fails today. *(Structural — unlike the prior already-green throw-short-circuit assertion.)* |

**Acceptance criteria** (4): (1) `resyncNow` returns a status + invokes `resyncAccount` WITH the limit on
the direct path; (2) `ResyncButton` always resolves its loading state, designed error on failure; (3) the
fan-out is bounded via an opt-in limit on resync while nightly stays uncapped; (4) a killed/partial resync
never marks a user onboarded with incomplete data (atomic `$transaction`). Each maps 1:1 above.

## Data-ops actions (gated human lane — confirmation rider only, NOT the fix)

1. **Vercel dashboard** — confirm plan (Hobby vs Pro) + the effective unset-default timeout, to pick a sane `maxDuration` safety budget. **Correctness does not depend on this** (fan-out bounded in code).
2. **Vercel Runtime Logs** — locate a pre-fix `resyncNow` "Task timed out" / duration-at-ceiling execution to confirm the fingerprint before, and verify it's gone after (observability).
3. **Supabase (read-only) SQL** — `SELECT "onboardedAt","lastSyncedAt" FROM "User" WHERE steamId='<id>';` plus `OwnedGame`/achievement-bearing counts, to quantify N and confirm the partial-kill fingerprint.

## Shared files, dependencies & non-negotiables

- **Shared:** `server/jobs/onboarding-backfill.ts` **and** `server/jobs/snapshot.ts` (both also **bug-03**) → serialize.
- **Dependencies:** bug-03 touches `onboarding-backfill.ts` (and `snapshot.ts` via the backfill path) — coordinate the `$transaction` boundary and the `achievementUnlockLimit`/`limit` signature additions (additive/backward-compatible, low conflict risk). **See PLAN.md ordering.**
- **Non-negotiables engaged:** degrade-never-crash (honest error state, never a silent hang or fabricated "Synced"); Steam access via the single rate-limited client, no inline fetch (offload route dropped → no new fetch surface); `STEAM_API_KEY` server-only, no `NEXT_PUBLIC_`, no `CRON_SECRET` forwarding; no new route handler; Tailwind tokens only; `steamId` stays a string (first arg; limit is the numeric 2nd arg); test-first (the partial-write test is now **structural**, not the already-green throw-short-circuit); ERR-0006 respected (all tests function-level or pure-component, `ResyncButton` is `use client`).

## Blast radius / rollback / regression risks

- **Blast radius:** settings re-sync flow + the shared backfill path. Behavior-preserving on shared paths — the limit is opt-in (nightly + first-login onboarding omit it → stay uncapped), and the `$transaction` only tightens atomicity of writes that already happened. No migration, no new route, no change to `/api/cron/snapshot` or `/api/import`.
- **Rollback:** all code (+ one optional segment export). Granular: the client try/catch is independently safe; the `limit`/`achievementUnlockLimit` params are additive (revert = stop passing them); the `$transaction` boundary and `maxDuration` are independently revertible. No data migration to unwind.
- **Regression risks:** too-low resync `limit` → fewer immediate unlock rows (nightly reconciles via idempotent upserts — verify nightly path unchanged); the `void→status` change **requires** updating `account-settings.test.ts §4 :305-322` (enumerated); the new `resyncAccount` 2nd param is optional but verify no caller positionally passes a wrong arg; wrapping onboarding writes in `$transaction` **requires** updating `onboarding-backfill.test.ts` `mockTransaction` (`:41-43`, array form → interactive callback) or its 29 green tests break (enumerated); coordinate ordering with bug-03 on the two shared files.

## Open questions

- **AbortSignal** on `achievements.ts fetchJson` (`:34-37`) — **explicitly waived/out-of-scope** (own task).
- Exact `maxDuration` value (confirmation-rider data-ops item) and exact `ACHIEVEMENT_RESYNC_LIMIT` (default 20) — tuning choices, not load-bearing for the bound's existence.
- Coordinate landing order with bug-03 on the two shared backfill files.

## Retry note & reviewer verdict

bug-04 took **3 rounds**: the initial pass and revision round 1 each returned `revise` (loose classification,
the cap/nightly contradiction, the conflated offload route, vacuous tests) and round 2 still failed a single
gate (`scopeOk`) because `server/repositories/account.ts` — the mandatory limit-forwarding hop — was missing
from the file manifest. It was **never rejected** (root cause is fully determined, 5/5), so a focused closing
round (beyond the nominal 2-round budget) addressed exactly the two remaining manifest/wording items. The
reviewer confirmed both genuinely addressed, re-ran the three affected suites green (29 passed) as the
red-first baseline, verified the type-consistent thread-through across all four touchpoints, and that nightly
+ first-login paths stay uncapped. **Approve, ready for implementation.**
