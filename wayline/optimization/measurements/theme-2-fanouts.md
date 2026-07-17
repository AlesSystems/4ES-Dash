# Theme 2 measurements — per-game external fan-outs

> Branch: `fix/opt-theme-2-fanouts` (stacked on `fix/opt-theme-3-shell` @ `21060a4`)
> Task commits: `7468c6c` (T1 schema), `bba85e6` (T2 writer), `c36be6d` (T3 reader), `95e9b9b` (T4 TTLs)
> Plan: `wayline/optimization/plan/PLAN-theme-2-external-fanouts.md` §Measurement plan
> Recorded: 2026-07-15 by the orchestrator. Nothing below is simulated — live/prod items
> are `handoff: manual`.

## Primary metric — STEAM-1 (`/library?multiplayer=1` data path)

| Item | Status | Detail |
|---|---|---|
| Before (wall-clock, cold) | **handoff: manual** | `performance.now()` around the `getMultiplayerAppIds` await in `app/library/page.tsx` at the theme base (`21060a4`), cold cache. Receipt-verified expectation: ≈ N × 250 ms (~16.3 s @ N=65), linear in N. |
| After (wall-clock) | **handoff: manual** | Same trace at branch HEAD. Expected: one DB read + retained `getProfile` (same-render cache hit), target < 100 ms, independent of N. |
| Zero Store calls (structural) | **PROVEN locally (CI-gated)** | Rewritten `tests/integration/multiplayer-repo.test.ts`: `getGameStoreMetadata`/`getGameStorePrice` mocks asserted never-called AND an MSW `appdetails` tripwire counts 0 HTTP requests, in a file-wide `afterEach` covering every test. |
| Zero added job Store calls | **PROVEN locally (CI-gated)** | `tests/unit/game-store.test.ts` `adds no extra Store calls` pins mocked `getGameStoreMetadata` call count === games.length (green-throughout tripwire). |

Sequencing caveat honored: Theme 3 (shell streaming) landed first, so user-visible LCP
deltas taken after this branch are attributable. The STEAM-1 metric above is a
server-duration metric, meaningful regardless.

## Secondary — STEAM-2 residual (T4 TTLs)

| Item | Status | Detail |
|---|---|---|
| Warm-instance call-count drop | **handoff: manual** | Second dashboard cold-cache cycle after 1 h on a warm instance: Steam Web-API calls for the top-20 set should drop from ≤60 toward ≤20 (schema/global still cached under `achievementSchema` 7 d / `achievementGlobal` 24 h). Resets on cold start until the bug-3 durable-cache decision. |
| TTL wiring | **PROVEN locally (CI-gated)** | `tests/unit/achievements-repo.test.ts` asserts the cache spy sees the dedicated TTLs on the `'global'` keys and `playerAchievements` on the per-user key. |

## Gated checks preserved (human/live lane, read-only — no task until they land)

1. **`ENABLE_STEAMSPY` prod value** (STEAM-3/bug-3 carryover) — Vercel env check; decides whether the dormant ~65 s genres path is live. Owned by bug-3 lane. `handoff: manual (prod)`.
2. **`web-api-transient-rate`** (STEAM-5) — Vercel function logs for `/` or a `withRetry`-exhaustion counter, per endpoint. If terminal-transient rate ≈ 0, STEAM-5 stays a non-issue; if materially > 0, open a follow-up task (each failing call adds ≈ 5.25 s). `handoff: manual (prod)`.
3. **Real library N** — prod `OwnedGame` count per steamId; confirms the ×N multipliers (all math assumes N=65). `handoff: manual (prod)`.
4. **Vercel instance concurrency** (STEAM-4) — feeds the Phase 6 limiter-partitioning decision this plan explicitly defers. `handoff: manual (prod)`.
5. **Platform tier / function timeout** — shared with Theme 5 context; T2 adds zero job wall-clock, so no new exposure. `handoff: manual (prod)`.

## First-run note

Until the first post-deploy nightly job, all `categoryIds` are `null` → the filter shows
everything as uncategorized (designed state, not a crash). Run the guarded cron once
manually after deploy (documented in ERR-0022).

## Environment note

All local results: darwin dev machine, SQLite dev DB, vitest. Full gate at closeout:
typecheck clean, lint clean, 111 files / 991 tests green.
