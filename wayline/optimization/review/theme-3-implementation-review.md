# Theme 3 implementation review — blocking shell and un-streamed pages

> **Date:** 2026-07-15
> **Reviewer:** adversarial reviewer (read-only), separate context from implementer
> **Contract:** `wayline/optimization/plan/PLAN-theme-3-blocking-shell.md` (entire doc) + `wayline/optimization/investigation/SUMMARY.md` (dependency notes)
> **Diff under review:** `git diff 140821b...HEAD` on `fix/opt-theme-3-shell`
> **Reviewed commits:**
> - `d436fb3` perf(shell): add geometry-matched header and sidebar skeletons (theme-3 T1)
> - `d1ef879` perf(shell): stream AppHeader and Sidebar behind Suspense boundaries (theme-3 T2)
> - `94c7d97` perf(profile): parallelize pre-authz session and privacy reads (theme-3 T3)

## GATE (run by reviewer, this session)

```
pnpm typecheck   → tsc --noEmit                    PASS (no output)
pnpm lint        → ✔ No ESLint warnings or errors  PASS
pnpm test        → Test Files 111 passed (111) · Tests 983 passed (983) · 20.48s  PASS
new suites only  → 6 files passed, 24 tests passed (header-skeleton 6, sidebar-skeleton 6,
                   shell-streaming 7, shell-degrade 2, authz-order 2, parallel-preauthz 1)
```

## Findings per hunt-list item

### 1. Acceptance criteria + TDD plan realization — MET (with two process nits)

Every TDD row (#2–#7; #1 was deleted from the plan by round-1 review) is realized at the planned path with the planned test name:

- **TDD #2 (binding proof for T2)** — `tests/unit/shell-streaming.test.tsx`: source-structure assertion per the `page-wiring` precedent; asserts exactly two `<Suspense>` blocks, `AppHeader`/`Sidebar` each a direct child of its own boundary with the correct skeleton fallback, `{children}` not inside either block, and neither shell component mounted outside its boundary. No async child is ever invoked (ERR-0006 respected). Reverting T2 makes `contains exactly two <Suspense> boundaries` fail (0 blocks) — regression-detecting.
- **TDD #3/#4** — geometry tests pin BOTH sides: skeleton side via rendered `className` strict equality (`toBe`), real side via source anchors on `components/layout/AppHeader.tsx` / `Sidebar.tsx`. I compared the class strings byte-for-byte myself: header outer `sticky top-0 z-40 border-b border-border bg-bg` and row `flex h-14 items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8` are identical in `HeaderSkeleton.tsx:30-31` and `AppHeader.tsx:62-63`; sidebar aside `sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-bg px-4 py-7 lg:block` identical in `SidebarSkeleton.tsx:20` and `Sidebar.tsx:27`. Drift in either file fails the suite.
- **TDD #5** — `tests/unit/shell-degrade.test.tsx`: all four mandated mocks present — (a) sync `vi.mock('@/components/auth/AuthControls')` stub, (b) `getViewerSteamId` fixed id, (c) `getProfile` rejecting `SteamApiError({kind:'private'})`, (d) `getLevel` rejecting. Asserts `Lv —`, `—` + `total`, explicitly asserts NO fabricated `Lv 0` / `0h`; Sidebar half correctly stub-free (its nav is the `'use client'` `SidebarNav`), asserts no numeric count chip and no shelf note.
- **TDD #6** — `tests/unit/app/public-profile-authz-order.test.tsx`: deferred `canViewProfile`; asserts `getProfile` uncalled while authz pends, called exactly once with `TARGET` after `true`, and never called on `false` (locked state rendered). Verified GREEN-at-base semantics by reading `git show 140821b:'app/u/[steamId]/page.tsx'` — the serial base preserves authz-before-data, so the pin holds at base and after T3.
- **TDD #7** — `tests/unit/app/public-profile-parallel-preauthz.test.tsx`: both mocks return unresolved deferreds and record start order; asserts both invoked while both still pend — a true concurrency assertion. Verified RED-at-base by reading the base source: `findUnique` could not be invoked until `getSessionUser` resolved.
- **T1 binding rule (AuthControls)** — verified on both axes: no `AuthControls` import in either skeleton file (read directly), no rendered usage, and the source-constraint tests regex-ban `AuthControls`, `async`/`await`, `@/server` imports, and `'use client'` on comment-stripped code. Every for-real reuse in the fallbacks is a verified `'use client'` component (`NavLinks.tsx:1`, `SidebarNav.tsx:1`); `ThemeToggle`/`MobileNav` were replaced with same-footprint pulses (h-8 w-8 / h-11 w-11 lg:hidden match the real components' trigger classes) with the swap-inertness rationale documented in the file — this substitution is explicitly sanctioned by the plan's swap-inertness note ("or fall back to a pulse placeholder for that slot").

Nits under this item: (i) TDD #6's pin was committed in the same commit as the T3 change (`94c7d97`), so git history cannot demonstrate "pinned before any code change" — semantics verified by source read instead; (ii) shell-streaming's `expect(layoutSrc).toContain('{children}')` is satisfiable by the layout's own JSX comment, which contains the literal `{children}` (`app/layout.tsx` comment block) — the load-bearing "not inside either boundary" assertion is unaffected.

### 2. Invariants table — HONORED line by line

| Invariant | Verdict | Evidence |
|---|---|---|
| RSC by default, zero new `"use client"` | MET | Both skeletons are sync server components; tests ban the directive |
| Geometry/CLS class equality | MET | Byte-identical outer classes verified by me and pinned two-sided by tests |
| Degrade, never fabricate | MET | `AppHeader`/`Sidebar` internals untouched; shell-degrade pins `—`/no-count/no-note and bans fabricated zeros |
| TTLs only in `server/cache/ttl.ts` | MET | File not in diff |
| withErrorBoundary untouched | MET | No route handlers in diff |
| Zod boundaries | MET | No I/O shape changes |
| `steamId` string | MET | Signatures untouched; test fixtures use 17-digit strings |
| No migrations | MET | None in diff |
| JS budget ≈ 0 delta | MET | Skeletons server-rendered; only already-bundled client components reused |
| Tokens only | MET | Read both files: `bg-surface-2`/`border-border`/`bg-bg`/`bg-brand-500` etc.; hex-ban asserted by tests |
| IDOR ordering on `/u/[steamId]` | MET | Only the pre-authz pair parallelized (`page.tsx:65-71`); `canViewProfile` → `getProfile` chain serial and comment-documented (`page.tsx:14-15, 62-64`); pinned by TDD #6 |

### 3. Scope discipline — MET

`git diff --name-only 140821b...HEAD` returns exactly the 10 files in the plan's Affected-files union (2 modified, 2 new components, 6 new test files). Zero diff under `app/insights/**` (bug-3 lane), zero under `app/game/**`, no `tests/layout/` root created, no existing test modified/weakened/deleted, no migration touched, no `package.json` change.

### 4. Cross-lane regressions — NONE

bug-2 baseline (`lib/insights/year-in-review.ts`, `server/repositories/profile.ts`) untouched; `server/cache.ts` single-flight untouched; `server/cache/ttl.ts` untouched; `lib/steam/limiter.ts`/`retry.ts` untouched; `AppHeader.tsx`/`Sidebar.tsx` internals untouched (their awaits now simply resolve inside boundaries). Full 983-test suite green confirms no behavioral drift in the five shipped bug-fix lanes.

### 5. Gate — GREEN (see GATE block above; run by me, not taken from the implementer)

### 6. Skeleton geometry, independently verified — MET

Compared byte-for-byte myself (not trusting the tests): both outer-element class strings identical to the real components. Slot footprints cross-checked against real components: MobileNav trigger `h-11 w-11 rounded-md lg:hidden` ↔ pulse identical; ThemeToggle `h-8 w-8 rounded-md` ↔ pulse identical; UserMenu `px-2 py-1` + 28px avatar + `hidden sm:block` name ↔ pulse cluster `px-2 py-1` + `h-7 w-7 rounded-full` + `hidden h-4 w-20 sm:block`. The tests would fail on drift in either direction (rendered `toBe` equality + source anchors).

### 7. Runtime streaming proof — correctly left manual

No Playwright config/dependency added, no fake runtime "streaming" test in jsdom (shell-streaming is purely structural). Consistent with T2's acceptance criterion and ERR-0006. However, the manual maintainer check has not yet been **recorded**: `wayline/optimization/measurements/` does not exist and no `theme-3-shell.md` was created — see NOTES; the plan's global exit criteria require it "performed and recorded" before the theme closes, and the "before (capture at HEAD, pre-T2)" measurement is now harder to capture retroactively.

## Itemized criteria table

| Criterion | Status | Evidence |
|---|---|---|
| T1: skeletons sync, no server/** imports, no AuthControls | MET | Files read; tests pin via comment-stripped regex |
| T1: byte-identical layout classes, asserted by test | MET | Verified independently + two-sided test pins |
| T1: no hex, tokens only, typecheck/lint green | MET | Tests + gate |
| T2: exactly two Suspense boundaries, children outside, proven structurally (TDD #2) | MET | `shell-streaming.test.tsx` (7 tests) |
| T2: runtime proof = manual maintainer step, no Playwright | MET (not yet recorded) | No harness added; measurements file absent |
| T2: degrade intact with AuthControls sync stub (TDD #5) | MET | `shell-degrade.test.tsx` |
| T2: zero changes under `app/insights/**`, `app/game/**` | MET | name-only diff |
| T2: full suite/typecheck/lint green | MET | Gate above |
| T3: authz-before-data pinned; never called on `false` (TDD #6) | MET | `public-profile-authz-order.test.tsx` |
| T3: pre-authz pair concurrent (TDD #7, RED at base) | MET | `public-profile-parallel-preauthz.test.tsx`; base source verified serial |
| T3: IDOR comment preserved + extended | MET | `page.tsx:14-15, 62-64` |
| Global: no diff outside Affected files | MET | 10/10 files match |
| Global: manual streaming check performed AND recorded | **NOT MET (pending)** | No `wayline/optimization/measurements/theme-3-shell.md` |
| Global: measurement before/after captured | **NOT MET (pending)** | Same |
| Required docs/ updates (FRONTEND.md, ARCHITECTURE.md, ERROR.md ERR-XXXX) | **NOT MET** | None of the three files in diff; no new ERR entry after ERR-0020 |

## BLOCKERS

1. **Required docs/ updates absent** (confidence ~75% this binds before merge). The plan's "Required docs/ updates" section mandates: `docs/FRONTEND.md` shell-streaming rule, `docs/ARCHITECTURE.md` data-flow amendment, and a `docs/ERROR.md` ERR-XXXX entry for the RSC-1/2 blocking-shell defect ("per the Error Logging rule"). None are in the diff. This repo's own conventions confirm docs land with the fix: bug-2 (`7078e80`) and bug-3 (`34e30da`) both touched `docs/ERROR.md` in the fix commit, and project CLAUDE.md makes the ERR log mandatory for agent-discovered defects. **Counter-reading, noted for the human:** the plan's global exit criteria say "no diff outside the files listed in 'Affected files'", and the Affected-files list omits docs — an internal plan contradiction the implementer resolved in favor of less work. If the human rules docs are sequenced as a follow-up commit alongside the measurement step, this blocker dissolves; the fix is docs-only either way, with zero code changes needed.

## NITS

1. `tests/unit/shell-streaming.test.tsx:64` — `expect(layoutSrc).toContain('{children}')` is vacuously satisfiable: the layout's JSX comment (`app/layout.tsx:69-72`) contains the literal `{children}`. Strip comments (as the skeleton tests already do) before asserting presence. The binding "not inside either boundary" assertion is unaffected.
2. TDD #6's invariant pin was committed in the same commit as the T3 change (`94c7d97`) rather than before it; the plan's risk section says "pinned … before any code change". Green-at-base verified by source read, so no exposure remains, but the history doesn't demonstrate the pin sequence.
3. `SidebarSkeleton` deviates from the plan's design prose ("only the count chip pulses") by omitting the chip entirely (renders `SidebarNav libraryCount={null}`, byte-identical to the degraded sidebar). Arguably better for swap-inertness; design prose, not an acceptance criterion. The `any pulse shard` test in `sidebar-skeleton.test.tsx:70-77` consequently iterates zero elements (vacuous but harmless).

## NOTES

1. **Theme cannot close yet even if the docs blocker is waived:** the global exit criteria require the manual runtime streaming check "performed and recorded" and the measurement before/after captured in `wayline/optimization/measurements/theme-3-shell.md`. The directory does not exist. The "before" trace was specified as "capture at HEAD, pre-T2" — capturing it now requires checking out `140821b`; do this before the branch merges or the baseline is lost to convenience.
2. Sequencing note honored: per `investigation/SUMMARY.md`, Themes 1/2/4/5 should land their LCP baselines only after this T2 ships — worth broadcasting to the other lanes once this merges.
3. The T2 implementation is exactly the plan's minimal shape (two boundaries, `{children}` outside, single-file change, single-file revert path). `AppHeader`/`Sidebar`/`AuthControls` and all data-layer files are untouched — rollback story per the plan holds.
4. Code quality is otherwise approve-grade: every per-task acceptance criterion is met with a regression-detecting test, all six TDD rows realized at the planned paths with the planned names, invariants hold line by line, scope is exactly the declared 10 files, and the full gate is green.

## VERDICT: REJECT

Reasons, itemized:
1. Plan section "Required docs/ updates" unmet: no `docs/FRONTEND.md` shell-streaming rule, no `docs/ARCHITECTURE.md` amendment, no `docs/ERROR.md` ERR-XXXX entry for the RSC-1/2 defect — required by the plan and by the repo's Documentation/Error-Logging rules, and contrary to the established docs-with-fix commit convention (bug-2/bug-3). Docs-only remediation; no code changes required. (If the human adjudicates the plan's internal contradiction — "no diff outside Affected files" vs "Required docs/ updates" — in favor of a sequenced follow-up commit, this verdict flips to APPROVE with no further findings.)

---

# Round 2 — re-review after closeout remediation

_(appended after the round-1 reject was remediated; see round-2 verdict below)_
