# Theme 5 — Background jobs (onboarding wall and nightly window): implementation review

- **Theme:** 5 — first-login onboarding backfill + nightly snapshot window (STEAM-7/8, COMP-5/6; STEAM-6 deferred)
- **Branch:** `fix/opt-theme-5-jobs`
- **Range:** `92b79ef...1015d9a` (T1 `76ebba3`, T2 `b967de0`, T3 `d477cb4`, closeout `1015d9a`)
- **Date:** 2026-07-16 · **Reviewer round:** 1 (adversarial, read-only)
- **Contract:** `wayline/optimization/plan/PLAN-theme-5-background-jobs.md` (REVISED), `wayline/optimization/investigation/SUMMARY.md`

## Full gate (run by this reviewer at HEAD `1015d9a`)

```
tsc --noEmit                  → clean (no output, exit 0)
next lint                     → ✔ No ESLint warnings or errors
vitest run                    → Test Files 115 passed (115) · Tests 1058 passed (1058) · exit 0
```

Matches the closeout claim (115 files / 1058 tests) exactly.

## Findings per hunt-list item

### 1. Acceptance criteria & TDD — MET, red-first evidence reproduced

I reproduced red-first genuinely: created a scratch worktree at base `92b79ef`, overlaid the four HEAD test files (`tests/unit/snapshot-achievement-unlocks.test.ts`, `tests/unit/onboarding-backfill.test.ts`, `tests/unit/snapshot-job.test.ts`, `tests/integration/snapshot.test.ts`), and ran them against base code:

- **RED at base, GREEN at HEAD** — rows 1 (budget cap, 120-game fixture), 2 (hot-set inclusion), 3 (rotation coverage/idempotence/empty-guard ×3), 4b (rewritten criterion-#6 pin), 5 (first-login limit spy: `calledLimit` was `undefined` at base), 7 (both timings unit tests: `result.timings` undefined at base), 8 (`JobRun.payload` timings round-trip), plus the `/onboarding` and cron `maxDuration` source/config pins. 12 red at base total, all green at HEAD.
- **GREEN at base (sanctioned pins)** — row 4 (`explicit limit path unchanged`, asserts exact ordered equality with the independent oracle `topGamesByPlaytime(games, 20)` — real teeth), row 6 (resync opts pass-through — see Minor-2), row 10 (cron auth 200/401 pins green at base with overlay AND green at HEAD — never went red across T3), plus the skeleton/Suspense structural assertion.
- **Row 9 (T4) is fully absent** — no seed-batching test, no `createMany` change in `server/jobs/onboarding-backfill.ts` (seed loop untouched), consistent with the honest skip (item 9 below). Not half-done.
- No vacuous assertions found; no pre-existing test deleted or weakened — the base file's 6 tests all survive at HEAD (5 verbatim + the sanctioned rewrite of the `:65` pin).

### 2. Criterion-#6 reconciliation — ALL THREE LEGS PRESENT

- **Test rewritten, not fixture-lucky:** the old 2-game single-run pin (base `tests/unit/snapshot-achievement-unlocks.test.ts:65-87`) is now the eventual-completeness test at HEAD `:82-129`: 70-game fixture (≥ 61 required), iterates `ceil(50/40) = 2` simulated day-keys via fake timers, asserts night 1 is budgeted (`≤ 60`, appId 7000 **not** in night-1 calls — deterministic: day-of-year 60 mod 2 = window 0 = appIds 21–60), and full coverage (`recorded.size === 70`, 7000 present) by cycle end. I verified the fixture math independently; it holds. Red at base.
- **Docstring:** `server/jobs/snapshot.ts:462-491` states the budgeted hot-set + rotation contract, the constant `≤ (20 + LIMIT) × 3` acquires bound, the `ceil(R/LIMIT)` convergence horizon, and delayed-not-lost via real `unlockedAt`. No single-run claim in that docstring. (One stale adjacent cross-reference remains — Minor-1.)
- **ACCEPTANCE companion note:** `docs/ACCEPTANCE.md:200-212` carries the revised eventual-completeness wording, the constant (40), **and** the fresh-user disclosure ("Year-in-Review achievement counts are incomplete for up to `ceil(R/40)` nights after first login"), citing the pinning test.

### 3. Rotation correctness — VERIFIED

- `rotationWindowForDay` (`server/jobs/snapshot.ts:429-435`) is a pure function of `(sortedAppIds, dayKey)`; no `Date.now()`/`new Date()` inside it or `dayOfYearUtc` (`:438-441`). The impure boundary is the single `utcDayKey()` call at the call site (`:502`), which is fake-timer-controllable — tests exploit exactly that.
- Same day ⇒ same window, consecutive days ⇒ successive windows, exactly-once-per-cycle, empty-input guard: all pinned at `tests/unit/snapshot-achievement-unlocks.test.ts:262-287`.
- Hot set: **new** helper `topGamesByTwoWeekPlaytime` (`:408-417`), sorts two-week → total → name; `lib/games/select.ts` has **zero diff** and still serves the explicit-`limit` branch (`:502`).
- Union/dedup: `nightlyUnlockCandidates` (`:449-460`) removes hot ids from `rest` **before** windowing — a game cannot appear in both, no double-processing possible; candidates ≤ 20 + 40 by construction and pinned by test.

### 4. Resync path byte-identity (bug-04-adjacent, ERR-0017) — HELD

- Explicit-`limit` branch unchanged: `candidates = topGamesByPlaytime(all, limit)` (`snapshot.ts:501-502`).
- `app/settings/actions.ts`, `server/repositories/account.ts`: **zero diff** (verified via `git diff --name-only` filter — 0 files under `app/settings`, `server/repositories`, `lib/steam`, `lib/games`, `prisma`, `server/cache`).
- Existing resync tests (`AC3 (bug-04): with limit=K…`) unmodified and green; new characterization pin adds exact-order equality.

### 5. T2 mechanics — VERIFIED

- `opts?.achievementUnlockLimit ?? ONBOARDING_UNLOCK_LIMIT` (`server/jobs/onboarding-backfill.ts:201-205`): `??` preserves an explicit `0` (falsy edge not overridden; `0` at base also meant `topGamesByPlaytime(all, 0) = []` — identical). Callers: `/onboarding` passes no opts → 20; `account.ts:84` passes explicit → unchanged.
- `{ onboarded:false, reason }` degradation and `$transaction` structure untouched (diff touches only the constant + the unlock call site); private-profile/transient tests pass unmodified.
- `app/onboarding/page.tsx:24-30`: `maxDuration = 60`, comment mirrors `app/settings/page.tsx:25-29` verbatim in style (including the same "plan-04 data-ops Vercel check" gate reference); skeleton/Suspense JSX unchanged and structurally pinned.

### 6. T3 mechanics — VERIFIED

- Five timing keys; the three best-effort passes record in `finally` (`snapshot.ts:211-241`); a throwing-pass test proves it for `refreshLibraryValueAggregate` + `refreshGameStoreData` (`tests/unit/snapshot-job.test.ts:169-181`). The two non-best-effort passes (`playtimeMs`, `achievementSnapshotMs`) correctly need no `finally` — a throw there aborts the user with no result to carry timings.
- `timings?: SnapshotPassTimings` is additive/optional (`snapshot.ts:88`); typecheck green proves existing consumers compile. Top-level summed keys byte-compatible (`runSnapshot` `:294-301` unchanged); integration test asserts both summed keys and per-user timings in the persisted `JobRun.payload`.
- Cron auth + documented try/catch exception untouched (diff adds only the `maxDuration` block at `app/api/cron/snapshot/route.ts:26-35`); the comment names gated check #4/platform-tier and the Hobby→60 fallback. `vercel.json` untouched.

### 7. Scope discipline — CLEAN

16 changed files, every one on the plan's Affected-files + Required-docs list (plus the sanctioned measurements file). Zero diff under `app/insights/**`, `lib/steam/**`, `server/repositories/**`, `prisma/**`, `server/cache/ttl.ts`, `lib/games/select.ts`, `vercel.json`. No migration. No limiter changes. Store repositories untouched (STEAM-6 fold correctly deferred). Per-commit stats map exactly to T1/T2/T3 task scopes.

### 8. Cross-lane regressions — NONE FOUND

- bug-2: reading surfaces untouched; rows carry Steam's real `unlockedAt` via immutable upsert (`upsertUnlockEvents:381-397`, unchanged) — delayed-not-lost holds; disclosure landed in ACCEPTANCE.
- bug-1: `clampPlaytime` and both clamp call sites untouched. ERR-0005: `grep skipDuplicates` over the diff → 0. Theme-1 bounded reads, Theme-2 persisted `categoryIds` path, `server/cache/ttl.ts`: all zero diff.

### 9. Docs honesty — VERIFIED, RECEIPTS REPRODUCED

- ERR-0024 appended template-compliant (all fields; `jobs` is an allowed module value; index row added after ERR-0023, no renumber/delete).
- BACKEND/DATA_MODEL/ACCEPTANCE/FRONTEND/API/DEPLOYMENT all match the implementation constant-for-constant (40, 20, `ceil(R/40)`, five timing keys, 300/60).
- Measurements receipts I re-ran myself on `prisma/ci.db`: the exact `OwnedGame⋈Game.hasStats` query → **52** (claimed 52); `OwnedGame` total → 67; `JobRun` → **0 rows** (claimed empty); local DB is SQLite. Convergence math `ceil(32/40) = 1` night checks out. The unconditional/contingent split is preserved — the whole-window metric is explicitly "NOT CLAIMED"; `platform-tier` and `db-rtt` recorded as `approval-required`/handoff, never guessed. T4's skip is honest: gate concerns the deployed Postgres RTT, unmeasurable locally; no seed-loop code shipped.

### 10. Full gate — GREEN (see top).

## Issues

**Blockers:** none.

**Minor (non-blocking):**

1. **Stale single-run claim survives in a neighboring docstring.** `server/jobs/snapshot.ts:339` (the `snapshotAchievements` docstring) still says unlock events are recorded "by `recordAchievementUnlocks` (over ALL achievement-bearing games), not here" — pre-existing text (base `:267`) missed by the T1 docstring sweep, now false under the budgeted contract. The plan-named docstring itself is compliant, but this cross-reference should be corrected in the docs sweep.
2. **Pin row 6 has a coincidence hole.** `tests/unit/onboarding-backfill.test.ts` ("resync opts pass through unchanged") forwards `achievementUnlockLimit: 20`, which equals `ONBOARDING_UNLOCK_LIMIT = 20` — the pin cannot distinguish verbatim forwarding from a bug that ignores opts and always applies the default. It does catch `undefined`/other-value regressions, and it implements the plan's TDD row literally. A sentinel value (e.g., 7) would give it full teeth.
3. **Comment typo, twice:** `ACHIEVEMENT_UNLOCK_ACHIEVEMENT_UNLOCK_NIGHTLY_LIMIT` at `tests/unit/snapshot-achievement-unlocks.test.ts:13` and `:87` (comments only; code references are correct).

**Notes for the human reviewer:**

- The "consecutive days ⇒ successive windows" property strictly holds within a calendar year; across Dec 31 → Jan 1 the day-of-year phase resets, which can transiently repeat or reorder one window. Convergence is unharmed (any `windowCount` consecutive days after Jan 1 cover all residues; worst case one stretched cycle). Untested, and the docstring states the property slightly stronger than the year-boundary reality.
- In production the two-week-playtime hot set drifts nightly, shifting the rest-list window boundaries, so "full coverage within exactly `ceil(R/LIMIT)` nights" is strict only for a stable hot set. This is the plan's own approved stateless design (rejected alternative #2); no game can be starved except under contrived oscillation, and delayed-not-lost holds regardless.
- The throwing-pass timing test covers two of the three best-effort passes; the `recordAchievementUnlocks` pass's `finally` is structurally identical but untested with a throw (it swallows per-game errors internally, so forcing an outer throw is awkward).
- `docs/API.md` also corrected the stale pre-batch response example — slightly beyond the additive-timings scope, but accurate and disclosed in the measurements file.

VERDICT: APPROVE
