# PLAN — 4ES-Dash critical bugs (Phase 2: Plan) — master plan

> Durable receipt of the read-only, adversarially-reviewed **planning** loop. Per bug:
> worker (Plan agent, opus, low, READ-ONLY) designs the fix → reviewer (reviewer agent, opus, xhigh,
> READ-ONLY) adversarially stress-tests it; revise rounds until `readyForImplementation = true`.
> **No app code was written; nothing with side effects was run; no live Supabase/Vercel/Steam call was made.**
>
> Runs: `wf_69ac764c-42e` (initial, 8 agents) · `wf_5113c225-a5c` (revision, 12 agents) ·
> `wf_a98f86a1-ea9` (bug-04 closing, 2 agents). **22 agents total.**
> Inputs: [SUMMARY.md](SUMMARY.md) + the four Phase-1 bug receipts. Per-bug plans:
> [plan-01](plan-01-dashboard-achievements-kpi.md) · [plan-02](plan-02-library-untouched-games.md) ·
> [plan-03](plan-03-history-week-month-filters.md) · [plan-04](plan-04-settings-resync-stuck.md).

---

## Stop state: **SUCCESS** — 4/4 ready for implementation

All four plans reached **`readyForImplementation = true`** with the fix type honestly classified, every
acceptance criterion mapped to a **red-first** test, scope correct, and all CLAUDE.md non-negotiables held.
**No bug was rejected**, so none returns to Phase 1.

## Verdict table

| Bug | Classification | Verdict | Ready | Effort | Conf. | Rounds | One-line fix |
|---|---|---|---|---|---|---|---|
| [01 — Dashboard Achievements KPI "—"](plan-01-dashboard-achievements-kpi.md) | **code-fix** | approve | ✅ | M | 5/5 | 2 | Give the Achievements tile its own Suspense boundary wired to `getAchievementProgress`; delete the hardcoded `achievementPercent={null}`. Genuine null → designed `—`, never 0%. |
| [02 — Library all "untouched"](plan-02-library-untouched-games.md) | **ux-degradation** | approve | ✅ | M | 5/5 | 1 | Derive `playtimeHidden` (all `total===0` **AND** some `lastPlayed!==null`) at `getProfile`; show an honest privacy banner + degrade the per-game/header/filter "Untouched" labels. Never fabricate playtime. |
| [03 — History week/month empty](plan-03-history-week-month-filters.md) | **mixed** (code + UX) | approve | ✅ | M | 5/5 | 1 | Snapshot **all onboarded users** (not just the featured `STEAM_ID`) via an extracted `runSnapshotForUser` + deduped best-effort fan-out; split the one empty state into "no snapshots yet" vs "still building". No backfill of history. |
| [04 — Re-sync spins forever](plan-04-settings-resync-stuck.md) | **code-fix** | approve | ✅ | M | 5/5 | 3 | Bound the per-game unlock fan-out via an opt-in `limit` threaded `actions→account→backfill→snapshot`; give `ResyncButton` a try/catch error path; wrap completion in a `$transaction`. Offload route dropped; AbortSignal waived. |

**Loop provenance.** Round 1 returned **`revise` on all four** (no rejects) — the adversarial pass caught
real defects: bug-01 routed load-bearing assertions through `render(await HomePage())` (forbidden by
**ERR-0006**); bug-02 under-reached (the literal "Untouched" label is per-game in `GameCard`/`GameRow`);
bug-03 had an invalid red-first condition + an undecided return shape; bug-04 had a loose classification, a
cap/nightly contradiction, and a conflated offload route. The revision round approved bug-02/03 immediately
and bug-01 after re-architecting tests; bug-04 needed a third focused round to add the missing
`server/repositories/account.ts` forwarding hop to its manifest. Every classification survived
adversarial review (bug-04 was tightened from `mixed` → `code-fix`).

---

## Implementation ORDER (serializes shared files)

The bugs are largely independent features; the **only genuine write-write overlap is `server/jobs/snapshot.ts`
(bug-03 + bug-04)**. `profile.ts` is written by bug-02 only (bug-01 just reads it);
`onboarding-backfill.ts` is written by bug-04 only (bug-03's final plan does **not** touch it).

| Shared file | Written by | Conflict? | Resolution |
|---|---|---|---|
| `server/repositories/profile.ts` | bug-02 (adds `playtimeHidden`); bug-01 **reads only** | No write-write | bug-02 owns the edit; additive optional field doesn't affect bug-01's reads. |
| `server/jobs/snapshot.ts` | bug-03 (`runSnapshot`/`runSnapshotForUser`, `SnapshotBatchResult`) **and** bug-04 (`recordAchievementUnlocks` optional `limit?`) | **Yes** | **Land bug-03 first**, then bug-04 rebases its additive `limit?` onto the extracted `runSnapshotForUser` (whose nightly call stays uncapped). |
| `server/jobs/onboarding-backfill.ts` | bug-04 only | No (bug-03 doesn't touch it) | bug-04 owns; coordinate only as a courtesy. |
| `server/jobs/index.ts` | bug-03 only | No | bug-03 owns. |

**Recommended sequence:**

1. **Tier A — parallel: bug-01 + bug-02.** No write-write conflict (bug-01 reads `profile.ts`; bug-02's
   `playtimeHidden` is an additive optional return field). Smallest blast radius; ship first.
   *(Zero-risk option: land bug-02's `profile.ts` change first, then bug-01.)*
2. **Tier B — bug-03.** Lands the `snapshot.ts` structural change (`runSnapshotForUser` extraction +
   deduped multi-user driver + `SnapshotBatchResult`), `server/jobs/index.ts` exports, and the
   three-way history empty states.
3. **Tier C — bug-04 (rebase onto bug-03's `snapshot.ts`).** Add the optional `limit?` to
   `recordAchievementUnlocks` (nightly call inside the extracted `runSnapshotForUser` stays uncapped), then
   `onboarding-backfill.ts` (`$transaction` + `achievementUnlockLimit` thread-through), `account.ts`,
   `actions.ts`, `ResyncButton.tsx`, `app/settings/page.tsx`.

> Each tier follows the project TDD loop (red-first test → implement → reviewer `APPROVE` → human merge) and
> the CI-parity gate (`pnpm lint && pnpm typecheck && pnpm test && pnpm build` exit 0). Per CLAUDE.md, **only
> the human merge marks a task done**.

---

## Consolidated acceptance-criteria → red-first test map

Every criterion below has a test that **fails today for the right reason against real code** (verified by the
reviewers, who ran the affected suites green as the baseline). No load-bearing assertion is routed through
`render(await Page())` (ERR-0006).

### Bug 01 — Dashboard Achievements KPI (`code-fix`)
| # | Acceptance criterion | Red-first test |
|---|---|---|
| 1.1 | Non-null percent → tile renders the %; null → designed `—` honest state. | `tests/unit/KpiRow.test.tsx` (new `AchievementKpiCell`/`KpiCell` exports don't exist → import fails) |
| 1.2 | Wrapper maps available→real %, unavailable→`—`, **never** a fabricated 0%. | `tests/unit/achievement-kpi-section.test.tsx` (`AchievementKpiSection` doesn't exist; MSW available/unavailable fixtures) |
| 1.3 | Page wires the boundary to `getAchievementProgress`; no hardcoded null. | `tests/unit/page-wiring.test.ts` (source assertion: `achievementPercent={null}` present today) |

### Bug 02 — Library "untouched" (`ux-degradation`)
| # | Acceptance criterion | Red-first test |
|---|---|---|
| 2.1 | `getProfile.playtimeHidden` = non-empty AND all `total===0` AND some `lastPlayed!==null`. | `tests/unit/profile-playtime-hidden.test.ts` (no `playtimeHidden` field today) |
| 2.2 | `lastPlayed` disambiguates privacy-hidden vs genuinely-new (all-null) accounts. | `tests/unit/profile-playtime-hidden.test.ts` (disambiguation case; replaces the prior vacuous test) |
| 2.3 | `GameCard` renders no literal "Untouched" when hidden. | `tests/unit/GameCard.test.tsx` (no prop today; always "Untouched" for `===0`) |
| 2.4 | `GameRow` renders no literal "Untouched" when hidden. | `tests/unit/GameRow.test.tsx` (no prop today) |
| 2.5 | `LibraryHeader` shows no fabricated never-played count when hidden. | `tests/unit/LibraryHeader.test.tsx` (no prop today; always `{untouchedCount} unplayed`) |
| 2.6 | `PlaytimeHiddenBanner` renders the honest explanation + concrete Steam privacy link, no number. | `tests/unit/PlaytimeHiddenBanner.test.tsx` (component doesn't exist) |
| 2.7 | "Untouched" status-filter chip is relabeled when hidden. | `tests/unit/LibraryControls.test.tsx` (no prop today) |

### Bug 03 — History filters (`mixed`)
| # | Acceptance criterion | Red-first test |
|---|---|---|
| 3.1 | Cron snapshots **every** onboarded user, not only `STEAM_ID`. | `tests/integration/snapshot.test.ts` (2 users + per-request MSW echo; today only 1 user → count 1) |
| 3.2 | One user's failure doesn't abort the batch; cron still 200. | `tests/integration/snapshot.test.ts` (A 500s, B's rows present, status 200; today rethrows → 500) |
| 3.3 | Target set deduped (featured-also-onboarded processed once). | `tests/integration/snapshot.test.ts` (`usersProcessed===1`; `runSnapshotForUser`/`Set` don't exist today) |
| 3.4 | Distinct honest empty states ("no snapshots" vs "still building"); chart only at ≥2 points. | `tests/unit/app/history-empty-state.test.tsx` (the two distinct strings don't exist today) |
| 3.5 | Cron response keeps backward-compatible summed top-level keys. | `tests/integration/snapshot.test.ts` (existing `:64-65` assertions stay green for one featured user) |

### Bug 04 — Re-sync spins forever (`code-fix`)
| # | Acceptance criterion | Red-first test |
|---|---|---|
| 4.1 | `resyncNow` returns an `OnboardingResult` (not void) and calls `resyncAccount` WITH the limit (direct path). | `tests/unit/account-settings.test.ts` (today void + single-arg `:305-322`) |
| 4.2 | `ResyncButton` always resolves its loading state; designed error on failure. | `tests/unit/resync-button.test.tsx` (no catch / no error state today) |
| 4.3 | Fan-out bounded via opt-in `limit` on resync; nightly (no-limit) stays uncapped. | `tests/unit/snapshot-achievement-unlocks.test.ts` (new capped case; `:65-87` unchanged) |
| 4.4 | Killed/partial resync never marks a user onboarded with incomplete data (atomic `$transaction`). | `tests/unit/onboarding-backfill.test.ts` (structural: no `$transaction` wraps the writes today) |

**Enumerated harness updates** (deliberate, not accidental): bug-04 updates `account-settings.test.ts §4
(:305-322)` for the `void→OnboardingResult` change, and `onboarding-backfill.test.ts` `mockTransaction
(:41-43, array form → interactive callback)` for the new `$transaction` boundary. bug-01 adds a `vi.mock`
**stub** for the new `AchievementKpiSection` in `homepage.test.tsx` / `homepage-stale.test.tsx` (stub-only,
no new assertions).

---

## Consolidated data-ops actions (gated human lane — run separately, NOT by any agent)

These are **verification/observability only** — none is a code substitute, and the code fixes are complete
without them. All are read-only.

### Steam Web API (read-only HTTP)
- **[bug-02]** `GET .../IPlayerService/GetOwnedGames/v1/?key=$STEAM_API_KEY&steamid=<AFFECTED_ID>&include_appinfo=1&include_played_free_games=1` — confirm (a) `games` present & non-empty, (b) each entry has **literal** `playtime_forever:0` (present, not omitted), (c) ≥1 non-zero `rtime_last_played` (the `lastPlayed` corroboration the heuristic relies on). *If `playtime_forever` is omitted, the symptom is a Zod/500 and the bug-02 plan is moot.*
- **[bug-02]** Sanity-check the real account shows nonzero playtime in the Steam client/web UI (details-private-hides-real-play vs genuinely-new).

### Supabase SQL (read-only)
- **[bug-03]** Per-user coverage: `SELECT "steamId", COUNT(*) rows, COUNT(DISTINCT "date") distinct_days, MIN("date") first_snap, MAX("date") last_snap FROM "PlaytimeSnapshot" GROUP BY "steamId" ORDER BY distinct_days ASC;` (expect most non-featured users at `distinct_days=1` pre-fix).
- **[bug-03]** Cron health: `SELECT date_trunc('day',"startedAt") day, status, COUNT(*) FROM "JobRun" WHERE name='snapshot' GROUP BY 1,2 ORDER BY 1 DESC LIMIT 30;` (day gaps / `status='error'` ⇒ cron not writing).
- **[bug-04]** Partial-kill fingerprint: `SELECT "onboardedAt","lastSyncedAt" FROM "User" WHERE steamId='<id>';` plus `OwnedGame` + achievement-bearing-game counts (quantify N).

### Vercel dashboard / logs (read-only)
- **[bug-03]** Confirm `/api/cron/snapshot` runs daily and returns **200** (not 401 from unset/mismatched `CRON_SECRET`, not 500); confirm `CRON_SECRET` is set in production env.
- **[bug-04]** Confirm plan (Hobby vs Pro) + the effective unset-default function timeout, to pick a sane `maxDuration` **safety budget** (correctness does not depend on it — the fan-out is bounded in code).
- **[bug-04]** Runtime Logs: locate a pre-fix `resyncNow` "Task timed out" execution to confirm the fingerprint before, and verify it's gone after.

### Capacity interaction (bug-03 ⟷ bug-04)
- **[bug-03 + bug-04]** The multi-user cron (bug-03) multiplies nightly Steam fan-out by the onboarded-user count, while bug-04 bounds the **interactive** resync. **Confirm the per-user nightly fan-out (rate-limited Steam calls × users) fits the `/api/cron/snapshot` function timeout**; if the user count is large, a follow-up may need batching/queueing for the cron. *(This is the one place the two timeout-adjacent fixes touch the same operational constraint — review together.)*

### Do-not / follow-ups
- **[bug-02]** **No data mutation / no re-sync** as a "fix" — re-syncing re-writes the same zeros while privacy is set.
- **[bug-03]** **No backfill** of historical snapshots from cumulative `playtime_forever` — unreconstructable; history accrues forward from the first post-fix nightly run.
- **[bug-02 follow-up]** File a tracked task: "Wire `playtimeHidden` into game/dashboard/`/u` pages" (`app/game/[appId]/page.tsx ~:115`, dashboard, `app/u/[steamId]/page.tsx` still render a fabricated 0-hours for hidden libraries). Explicitly **waived** for the in-scope library fix.
- **[bug-04 follow-up]** `AbortSignal` on `lib/steam/achievements.ts fetchJson (:34-37)` is **waived** for bug-04 (distinct upstream-stall failure mode touching every shared-client consumer) — its own task.

---

## Authority

**Proposal only.** The human (`Altan Esmer`) approves this PLAN.md before any code is written. Code changes,
the live Supabase/Vercel/cron lane, deploy, commit, and push all remain **outside this phase**.
