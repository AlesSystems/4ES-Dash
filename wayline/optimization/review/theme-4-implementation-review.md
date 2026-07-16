# Theme 4 — Client payload and DOM size: implementation review

- **Theme:** 4 — Client payload and DOM size (FE-1, FE-2 gated, COMP-7)
- **Branch:** `fix/opt-theme-4-client-payload`
- **Diff under review:** `d419850...b11bed2` (T1 `ed0e124`, T3 `dba2a47`, T2 `e2cbb02`, closeout `b11bed2`)
- **Date:** 2026-07-16 · **Reviewer round:** 1 (adversarial, read-only, separate context)
- **Plan of record:** `wayline/optimization/plan/PLAN-theme-4-client-payload.md` (revised through round-1 second pass)

## Full gate (run by this reviewer on `b11bed2`)

```
pnpm typecheck  → clean (tsc --noEmit, no output)
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → Test Files 115 passed (115) · Tests 1044 passed (1044) · Duration 20.71s
```

Matches the claimed 115 files / 1044 tests exactly. Gate is green.

## Hunt-list findings

### 1. Acceptance criteria and TDD-table evidence — MET, red-first independently reproduced

I overlaid HEAD's five test files onto a scratch worktree checked out at base `d419850` and ran them against base code. Result: **9 failed | 56 passed**, failing exactly where the TDD table demands red:

- Row 1 `toLibraryTile strips non-tile fields` — red at base (function absent), green at HEAD (`tests/unit/sort.test.ts:79`). Asserts `Object.keys` equality on both the outer object and `playtime` — not vacuous.
- Row 2 `parseLimitParam defaults, clamps, and snaps to page size` — red at base, green at HEAD (`tests/unit/sort.test.ts:103`). Covers missing/garbage/negative/zero → 24, pass-through multiples, snap-DOWN rule **documented in the test comment**, clamp `'99999'` → 960.
- Rows 3/3b/4 (`tests/unit/LibraryResults.test.tsx`) — all three red at base (component sliced internally, had `'use client'` + `useState`, no `filteredTotal` prop), green at HEAD. Row 3b's fixture genuinely distinguishes the mis-wire: same 24-tile page with `filteredTotal={40}` asserting `24 of 40 · 16 remaining` — wiring the all-games total (100) fails it.
- Rows 5/5b (`tests/unit/LoadMoreButton.test.tsx`) — the entire file fails to load at base (component doesn't exist): red. Row 5b mocks a fresh visit with **no** `limit` key (`view=list&q=hades`) and asserts `limit=48` plus filter preservation plus `{ scroll: false }`.
- Row 6 (`tests/unit/LibraryControls.test.tsx:174–235`) — the four delete-`limit` assertions (status/sort/q-with-debounce-flush/multiplayer) red at base; the `view toggle preserves limit` pin green at base by design (that direction pins HEAD behavior). Both directions asserted at HEAD.
- Row 7 (`tests/unit/achievements-aggregate.test.ts:398+`) — green-from-start pins, which the plan explicitly sanctions. I additionally **perturbation-proved** them myself in a scratch worktree at HEAD: flipping the comparator to `a.ms - b.ms` → 3 tests fail; changing `>= cutoff` to `> cutoff` → the boundary pin fails. The pins are real tripwires.
- Row 8 — correctly **absent** along with T4: `tests/unit/AchievementList.test.tsx`, `components/game/AchievementList.tsx`, and `app/game/[appId]/page.tsx` all untouched. Not half-done.
- No test file deleted or weakened: `git diff d419850...HEAD --diff-filter=D --name-only` is empty; the only edit to existing tests is the parameterized `useSearchParams` mock in `LibraryControls.test.tsx` (behavior-preserving, reset in `beforeEach`).

### 2. T2 mechanics (round-1/round-2 adjudications) — all honored

- **`updateUrl` reset:** `components/library/LibraryControls.tsx:22` defines `SET_CHANGING_KEYS = ['q','status','sort','multiplayer']`; `:74–76` deletes `limit` only for those keys. `view` excluded with the correct rationale in the comment. Both directions tested (see row 6 above).
- **Filtered count:** `app/library/page.tsx:162–163` passes `games={shown.slice(0, limit).map(toLibraryTile)}` and `filteredTotal={shown.length}` — `shown.length` is computed pre-slice from the filtered+sorted set (`page.tsx:108–111`). `components/library/LibraryResults.tsx:37` computes `remaining = filteredTotal - games.length`. Row 3b's active-filter fixture pins it.
- **`LoadMoreButton` limit derivation:** `components/library/LoadMoreButton.tsx:26` — `const current = parseLimitParam(searchParams.get('limit'))`; copies all params, sets `limit`, `router.replace(..., { scroll: false })` (`:27–29`). Fresh-visit 24→48 pinned by row 5b.
- **`parseLimitParam`:** `lib/games/sort.ts:106–111` — default 24, `Math.min(Math.floor(n), MAX_LIMIT=960)`, snap down via `clamped - (clamped % PAGE_SIZE)`. Snap rule documented both in JSDoc and in the test.
- **Structure:** remount `key` dropped (`page.tsx:156–166`, no `key` prop); `force-dynamic` untouched (`page.tsx:35`); `LibraryResults` is a **synchronous** named-export function with zero `'use client'`/`useState` (self-pinned by its own source-level test, per ERR-0006); the only new client file in the diff is `LoadMoreButton.tsx`.
- **Unresolved objection #1 (Zod):** `git log e2cbb02 --format=%B` contains the explicit acceptance: "parseLimitParam deliberately follows the shipped non-Zod parseSortKey/parseStatusKey searchParams-parser precedent … (plan unresolved objection #1, option accepted explicitly)." The plan's merge precondition is satisfied.

### 3. T1 projection — MET

`lib/games/sort.ts:27–48`: `LibraryTileGame` is exactly the six leaf fields; `toLibraryTile` builds a fresh object (no spread leakage of `iconUrl`/`lastPlayed`/`acquiredAt`). Sorting consumes the full `LibraryGame` before projection (`page.tsx:108–111` sort/filter → `:162` slice+map). `GameCard.tsx`/`GameRow.tsx` untouched; `pnpm typecheck` clean proves no consumer needs the dead fields.

### 4. T3 — MET

`lib/achievements/aggregate.ts`: exactly one `new Date(item.unlockedAt)` per unlocked item (`:163`); comparator is `(a, b) => b.ms - a.ms` (`:171`) — no `Date` construction in the sort. `MergedAchievement`/`LibrarySummary` type declarations unchanged (diff touches only the function body). `mergeGameAchievements` and `server/repositories/achievements.ts` untouched; no cache-wrap, no TTL added.

### 5. Scope discipline — CLEAN

`git diff d419850...HEAD --name-only` = 13 files, every one justified by the plan's Affected-files list, the TDD table, the Required-docs update (`docs/FRONTEND.md`), or the measurements file. Zero diff under `app/insights/**`, `server/**`, `prisma/**`; `next.config.mjs`, `SharedGamesTable`, `FriendsList`, `PlaytimeHiddenBanner`, `GameCard`, `GameRow`, `AchievementList` all untouched. No migration touched. One sanctioned deviation, recorded in-file: measurements live at `wayline/optimization/measurements/theme-4.md` (themes 1–3 convention) instead of the plan's `plan/measurements-theme-4.md` — the file itself flags this.

### 6. Cross-lane regressions — NONE FOUND

bug-1's `getFirstSeenDates` call preserved verbatim (`page.tsx:66`) with the `acquiredAt` merge feeding `sort=added` (`:67`); `getMultiplayerAppIds` call shape unchanged (`page.tsx:98`); `server/cache/ttl.ts` not in the diff; the private-profile catch (`page.tsx:68–81`), `StaleBanner`, and `LibraryEmpty`/`EmptyState` branches untouched. All prior-theme suites green in the full gate. I also checked for other `/library` navigation surfaces that could carry a stale `limit`: `LibraryEmpty`'s links go to bare `/library` (drop all params) — `updateUrl` remains the only param-preserving nav surface, as the plan claimed.

### 7. AC6 / Playwright honesty — claim TRUE; recording GAP (minor)

The claim is true: no `playwright.config.*`, no `*.spec.ts` anywhere outside `node_modules`, no `playwright` in `package.json`; the only lockfile hit is Next 14.2's **optional** peerDependency stanza. AC6 is self-conditioning ("if the e2e suite covers `/library`") — the condition is objectively false, and its unconditional clause (test/typecheck/lint green) is verified above; unit rows 3/5/5b cover the behavior. **However**, the disposition is recorded nowhere in theme-4's committed artifacts — `measurements/theme-4.md` contains no Playwright/e2e/AC6 mention (theme-3 recorded the equivalent fact in its measurements file). Not silently *fabricated*, but silently *skipped* as a record. Itemized below as MINOR; this verdict document now constitutes the record.

### 8. Docs honesty — VERIFIED

- `docs/FRONTEND.md` rendering rule 6 is the plan's big-list recipe and matches the implementation constant-for-constant (24/960/snap-down/`filteredTotal`/set-changing-key reset/view-preserve). No other doc references FRONTEND rules by number, so the renumbering (shell streaming → rule 7) breaks nothing.
- `measurements/theme-4.md` records only what ran. I re-verified independently: **after** build `/library` = 3.06 kB / 112 kB First Load JS (exact match); **before** build at `d419850` in a scratch worktree = 4.14 kB / 113 kB (claimed 4.15 kB — rounding-level build nondeterminism; delta direction confirmed). Transferred-bytes items honestly `handoff: manual` with the plan's exact steps including the post-filter no-`limit` precondition and the cumulative page-to-end check. Gate table: local `ci.db` really has `Achievement` = 0 rows and `OwnedGame` = 67 rows (I ran the queries), and the `Friend` table really does not exist in the schema — the stale-query flag is accurate.
- **T4 disposition is honest:** with 0 local `Achievement` rows the distribution gate is unmeasurable; recording `approval-required — T4 skipped; FE-2 neither implemented nor demoted` is the correct refusal to fabricate. Demoting FE-2 on an empty table would have been a fabricated measurement; the plan's binary (confirm→build / thin→demote) presumed a populated DB it didn't have.
- `docs/API.md` no-change verified and recorded in the committed measurements file, per the theme-1 review nit.

### 9. Invariants — HELD

Strict TS clean, no `any` in new code; named exports throughout (`LoadMoreButton`, `toLibraryTile`, `parseLimitParam`, `PAGE_SIZE`, `MAX_LIMIT`); pagination is pure URL state (no store/context/`useEffect` fetching); new JSX uses Tailwind tokens only (no hex found in the diff's added lines); `steamId` untouched; no TTLs, no route handlers, no migrations; counts computed pre-slice so nothing is fabricated; degradation paths and skeleton geometry untouched; the only client-boundary payload is now the bounded projected page.

### FE-1 ERR-entry call (explicitly mine per the plan)

**No ERR-XXXX entry required.** `docs/ERROR.md` is the log of *encountered* errors; FE-1 is a performance finding, no runtime error was fixed or encountered during implementation (all gates green throughout). The generalized prevention rule the plan wanted captured — "Never ship an unbounded array across a `'use client'` boundary" — now lives verbatim as `docs/FRONTEND.md` rendering rule 6, which is the discoverable home for a frontend design rule. Duplicating it as an ERR entry would dilute the error log. No follow-up required.

## Itemized issues

| # | Severity | Issue |
|---|---|---|
| 1 | MINOR (docs) | AC6/Playwright environment-blocked disposition is not recorded in any committed theme-4 artifact (`measurements/theme-4.md` has no mention; theme-3 set the precedent of recording it). The claim is true and the AC is self-conditioning, so non-blocking; this verdict is now the record — a one-line addition to `measurements/theme-4.md` in the next docs commit would close it cleanly. |
| 2 | NIT | `MAX_LIMIT = 960` dead-end: at `?limit=960` with a filtered set larger than 960, `LoadMoreButton` still renders and clicking is a visual no-op (URL → 984, server snaps back to 960). Plan-sanctioned hard max, unreachable at the real N = 67; worth a follow-up guard (`disabled` or hide at cap) if large libraries become real. |
| 3 | NIT | The page-level slice expression itself (`page.tsx:162`) is pinned only by review + typecheck — the unit suite hands `LibraryResults` a pre-sliced page (exactly the plan's TDD row-3 shape, so sanctioned; ERR-0006 bars rendering the async page in jsdom). Removing `.slice(0, limit)` in the page would only be caught by the manual transferred-bytes measurement. Acceptable under the plan; recorded for the human reviewer. |
| 4 | NIT | `parseLimitParam` accepts exotic `Number` formats (`'0x30'` → 48, `'4.8e1'` → 48). Harmless — always clamped and snapped — consistent with the accepted non-Zod precedent. |

## Notes for the human PR reviewer

- Red-first evidence was **reproduced, not taken on faith**: HEAD tests run against base code fail exactly per the TDD table (9 red), and the T3 green-from-start pins were perturbation-proved (comparator flip → 3 red; cutoff exclusivity flip → 1 red).
- Both route-JS numbers were re-derived from real builds this session (base worktree + HEAD), not copied from the measurements file.
- The primary FE-1 metric (transferred bytes on an authenticated render) remains an honest `handoff: manual` — nothing in this approval certifies the absolute byte numbers, only the structural mechanism (bounded, projected payload) and the route-JS delta.

VERDICT: APPROVE
