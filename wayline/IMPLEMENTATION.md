# IMPLEMENTATION — 4ES-Dash bug batch 2 (Phase 3: Implement) — ship-readiness

> Durable receipt of the test-first, adversarially-reviewed **implementation** loop
> (run `wf_2e75ce84-1bf`, 8 agents, ~30 min). Per task: implementer (opus, low, TDD,
> isolated worktree) -> reviewer (opus, xhigh, read-only, re-ran every gate + verified
> red-first against the diff parent). **Local commits only — nothing merged, pushed,
> deployed, or migrated; those lanes stay human-gated.**
> Inputs: wayline/bug-*.md seeds + wayline/evidence/ Phase-1 receipts + the inline plan of record.

# 4ES-Dash Bug-Fix Phase — SHIP-READINESS Report

Implementation ran in isolated git worktrees, one branch per bug, **local commits only**. Nothing has been merged, pushed, deployed, or migrated — those are human-gated (Section 3). Evidence below is drawn solely from the task records.

---

## 1. Per-Bug Status Table

| Bug | Title | Status | Branch | Commit subject | Reviewer verdict (rounds) | Red-first verified |
|-----|-------|--------|--------|----------------|---------------------------|--------------------|
| bug-1 | History page empty until snapshots span ≥2 periods | **done** | `fix/bug-1-history-period-cliff` | `fix: draw history chart for short spans and gate onboarding` | approve (1) | ✅ yes |
| bug-2 | Year in Review zeroes/under-counts current-year hours | **done** | `fix/bug-2-yir-baseline` | `fix: reach back to pre-year baseline for Year-in-Review hours` | approve (1) | ✅ yes |
| bug-3 | Insights pages slow — flag-independent fixes only (part a PARKED) | **done** | `fix/bug-3-insights-perf` | `fix: speed up insights pages (stream, de-dupe session, bound scans)` | approve (1) | ✅ yes |
| bug-4 | Image onError fallback hardening | **parked** | `fix/bug-4-image-fallback` | *(not committed — PARKED)* | — (no review) | ✅ yes (red only; never reached green) |
| bug-5 | Genre breakdown folds empty-genre games into "Unknown" | **parked** | *(none)* | *(none)* | — (no agent spawned) | — (no code) |

**Gate summary for the 3 done bugs** (all reviewer-reconfirmed by independent worktree re-run):

| Bug | Named suites | Full `pnpm test` | typecheck | lint | ERR entry |
|-----|--------------|------------------|-----------|------|-----------|
| bug-1 | 23/23 | 104 files / 947 tests | clean | clean | ERR-0018 (frontend) |
| bug-2 | 31/31 (2 files) | 104 files / 948 tests | clean | clean | ERR-0019 (backend) |
| bug-3 | 18/18 | 105 files / 952 tests | clean | clean | ERR-0020 (frontend,db) |

Note: each bug's "full suite" count reflects that worktree in isolation. The three done branches are **not yet integrated together**, so those file/test totals will reconcile only after merge (Section 2).

---

## 2. Recommended Integration Order

Two clusters share files. Cluster A branches touch aggregate/year-in-review semantics; Cluster B shares the insights/library surface. **bug-2 and bug-3 both edit `server/repositories/insights/year-in-review.ts` (:38–41)** — this is the primary integration-order conflict.

**Merge order:**

1. **bug-1** (`fix/bug-1-history-period-cliff`) — Cluster A. Touches `lib/history/aggregate.ts` and `app/history/page.tsx`; no overlap with bug-2/bug-3 source. Merges cleanly first.
2. **bug-2** (`fix/bug-2-yir-baseline`) — Cluster A. Establishes the pre-year **baseline reach-back** in `server/repositories/insights/year-in-review.ts` (baseline derivation) and `lib/insights/year-in-review.ts`. **Merge before bug-3** so the semantic change (baseline logic) lands before bug-3's date-bound (a mechanical `where.date` scope addition at the same :38–41 region).
3. **bug-3** (`fix/bug-3-insights-perf`) — Cluster B. Adds an **ADD-only date bound** to the same `year-in-review.ts` window (:38–41). Per both reviewers this bound is **semantics-preserving** (`computeYearInReview` already filters to `getUTCFullYear() === year`), so it composes with bug-2's baseline logic. **Expect a textual conflict at :38–41** — resolve by keeping bug-2's baseline derivation AND bug-3's `date: { gte..., lt... }` window bound (both belong in the final `findMany` where clause). Verify the merged file still passes both bug-2's baseline tests (total 250, not 150) and bug-3's date-bound test (`where.date.gte instanceof Date`).

**Primary conflict — `server/repositories/insights/year-in-review.ts` (:38–41):** bug-2 adds in-memory baseline derivation (latest `playtimeForever` per app strictly before UTC Jan-1); bug-3 adds the date-bound scan window. These are complementary, not contradictory — a manual take-both merge, then re-run both suites.

**`docs/ERROR.md` — take-both textual conflict (trivial):** all three done branches append a **distinct** ERR entry (ERR-0018, ERR-0019, ERR-0020) plus an index-table row. Each diff is additions-only and no branch modifies an existing entry, so every merge conflict here resolves by **keeping both** the appended section and both index rows. No semantic reconciliation needed.

**Bug-4 / bug-5:** nothing to integrate (bug-4 reverted to a clean worktree; bug-5 has no branch).

---

## 3. Remaining Human-Gated Lanes

**Cross-cutting (all done bugs):**
- **Merge** the three approved branches in the order above (Section 2), resolving the `year-in-review.ts` :38–41 and `docs/ERROR.md` take-both conflicts.
- **Push** — no branch was pushed. bug-2's record explicitly notes "push branch and open a PR … not done per instructions — no push."
- **Deploy** — none performed; human-gated.
- **Migration apply** — **none required.** No branch edits `prisma/`. bug-3's date bounds rely on the *existing* `@@index([steamId, date])`; bug-2 derives baseline in-memory with **no new query**. No migration to apply.

**Bug-specific human gates:**

- **bug-1 — snapshot cron / coverage (verification lane):**
  - VERIFY the production snapshot cron fires daily → 200 (not 401 from unset/mismatched `CRON_SECRET`, not 500) so history accrues forward for onboarded users.
  - Read-only coverage query: `SELECT "steamId", COUNT(*) rows, COUNT(DISTINCT "date") distinct_days, MIN("date"), MAX("date") FROM "PlaytimeSnapshot" GROUP BY "steamId" ORDER BY distinct_days ASC` — confirm short-span users render (day-fallback) and multi-day users accrue.
  - Do **NOT** backfill historical rows from cumulative `playtime_forever`; history accrues forward only.

- **bug-2 — YIR baseline confirmation:**
  - Confirm the `partialYear` caveat is surfaced in the UI (`app/review/[year]/page.tsx` / `ReviewCover`). This change adds the flag to the **data layer only**; the designed caveat state / copy is an out-of-scope product/design decision.
  - Verify against a real multi-year account that the derived-from-fetched-rows baseline matches expectations at scale.

- **bug-3 part (a) — ENABLE_STEAMSPY prod check (unblocks the parked half):**
  - Confirm the `ENABLE_STEAMSPY` prod value and take one timing measurement **before** relocating the flag-gated SteamSpy-tag enrichment off the render path into the nightly job. The `ENABLE_STEAMSPY` enrichment loop in `server/repositories/insights/genres.ts` is **left as-is** and still flag-gated; the ERR-0011 0-network regression pin is still green.

- **bug-4 — OBS live repro (fix-vs-hardening decision):**
  - Confirm whether app `1905180` `header.jpg` actually 404s. Wayline evidence says all OBS art returns HTTP 200, so this fallback is **hardening** for delisted/region-locked titles, **not** the fix for the reported OBS "no image." A human must decide whether bug-4 is closed by hardening alone or needs a separate OBS root-cause.

- **bug-5 — Unknown-label product decision:**
  - DECIDE the path: (1) **relabel** at the `lib/insights/genres.ts` label site, (2) **exclude** empty-genre apps from the chart (relying on the `unknownFromUnavailable` note), (3) **enrich** via Store app type / SteamSpy so OBS(1905180) → "Software", or (4) **no-op/document**. Phase-1 recommendation: pair with bug-4 since software titles are the shared upstream cause.
  - Once decided, implement red-first (test updated off "Unknown"), keep the all-empty "No genre data yet" path and `unknownFromUnavailable` count correct.

---

## 4. Parked / Blocked Work — Exactly What Unblocks Each

### bug-3 part (a) — SteamSpy enrichment relocation (PARKED, rest of bug-3 shipped)
- **State:** flag-independent fixes are done, reviewed, approved, committed. Part (a) — moving flag-gated SteamSpy-tag enrichment off the render path into the nightly job — is left as-is in `server/repositories/insights/genres.ts` (the `ENABLE_STEAMSPY` loop is unchanged).
- **Blocked on:** the unattached Phase-1 human check.
- **Unblocks when:** a human confirms the `ENABLE_STEAMSPY` prod value and takes one timing measurement, then the enrichment can be relocated to the nightly job.

### bug-4 — Image onError branded fallback (PARKED, worktree reverted clean, not committed)
- **State:** the production fix is sound in design — a shared `'use client'` `GameImage` wrapper that on `onError` swaps to a branded lucide `ImageOff` overlay (Tailwind tokens only, fill geometry preserved, image hidden not unmounted). `GameImage.test.tsx` (2 tests) passed in isolation and `GameCard-playtime-hidden.test.tsx` (3 tests) passed with the overlay fix.
- **Blocker:** rendering any of the five components through `GameImage` under jsdom crashes (`Objects are not valid as a React child ([object HTMLImageElement])`) because next/image's synchronous mount-error in jsdom trips React 18 concurrent error recovery. The repo's established `vi.mock('next/image')` in a test file does **not** intercept the next/image import inside the separately-transformed `GameImage` `'use client'` module, so the mock is ineffective for exactly the components that must change. All edits were reverted to leave the worktree clean rather than weaken shared infra unilaterally or commit past a red gate.
- **Unblocks when:** a **test-architecture decision** is made (all options are outside this task's assigned file list):
  - (a) add a global `vi.mock('next/image')` in `tests/setup.ts` (affects ~60 suites), or
  - (b) adjust `vitest.config.mts` deps/ssr handling so `'use client'` component modules are mockable, or
  - (c) sanction per-file mocks and confirm they intercept in this repo's setup.
- **Then:** implementation is straightforward — create `components/ui/GameImage.tsx`, swap `<Image>` → `<GameImage>` in the five renderers (GameCard, GameRow, GameTile, GameHero, RecentlyPlayed), soften the `lib/steam/schemas.ts:70-71` "Always resolvable" comment, add **ERR-0021** (not yet appended).
- **Second, independent gate:** the OBS live repro decision (Section 3) — hardening vs. separate OBS root-cause.

### bug-5 — Genre "Unknown" folding (PARKED at planning, no agent spawned)
- **State:** no branch, no worktree, no code. `wayline/bug-5-insights-unknown-label.md` still lists all four options open (relabel / exclude / enrich / no-op). Per HARD BOUNDARIES the product answer is never guessed, so no agent was spawned.
- **Unblocks when:** a human DECIDES the Unknown-label path (Section 3). Then implement red-first, preserving the all-empty "No genre data yet" path and the `unknownFromUnavailable` count.

---

## 5. Worktree Inventory (for per-diff inspection)

| Bug | Branch | Worktree path | Local commit? |
|-----|--------|---------------|---------------|
| bug-1 | `fix/bug-1-history-period-cliff` | `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/.claude/worktrees/wf_2e75ce84-1bf-1` | ✅ committed |
| bug-2 | `fix/bug-2-yir-baseline` | `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/.claude/worktrees/wf_2e75ce84-1bf-4` | ✅ committed (`7078e80`; branch renamed from the auto worktree branch post-run) |
| bug-3 | `fix/bug-3-insights-perf` | `/Users/altanesmer/Desktop/AlesSystems/4ES-Dash/.claude/worktrees/wf_2e75ce84-1bf-2` | ✅ committed |
| bug-4 | `fix/bug-4-image-fallback` (at base, no commit) | *(worktree auto-removed — reverted pristine)* | ❌ reverted clean (no commit) |
| bug-5 | *(none)* | *(none)* | ❌ no branch/worktree |

Reviewers confirmed the bug-1, bug-2, and bug-3 worktrees were each restored bit-identical after red-first verification (empty `git status --porcelain`, HEAD unchanged). The bug-4 worktree was auto-removed after the implementer reverted it pristine; branch `fix/bug-4-image-fallback` remains, pointing at base with no commit. bug-5 has nothing on disk.

---

**Bottom line:** 3 of 5 bugs are done, reviewer-approved (approve, 1 round each), red-first verified, and green on all four gates in isolation — ready to merge in the order **bug-1 → bug-2 → bug-3**, watching the `year-in-review.ts` :38–41 take-both conflict and the trivial `docs/ERROR.md` take-both. No migrations to apply. 2 bugs are parked on explicit human decisions: bug-4 on a test-architecture choice (plus the OBS fix-vs-hardening call), bug-5 on the Unknown-label product path. bug-3 part (a) remains parked on the `ENABLE_STEAMSPY` prod check.