# Plan 01 — Dashboard Achievements KPI shows "—" (Hours render fine)

> Phase-2 fix plan. Worker (Plan, opus, low) → adversarial reviewer (reviewer, opus, xhigh), READ-ONLY.
> **Verdict: `approve` · readyForImplementation = `true`** (round 2 — see retry note).
> Source of truth: [bug-01-dashboard-achievements-hours.md](bug-01-dashboard-achievements-hours.md).

| Field | Value |
|---|---|
| Fix classification | **code-fix** (reviewer upheld) |
| Effort | **M** |
| Worker confidence | 5/5 |
| Reviewer verdict | approve · ready=true · classOk · testMapOk · redFirstOk · scopeOk · nonNegOk · priorAddressed |
| Rounds to approval | 2 (round 1 = revise on test infeasibility; round 2 = approve) |

## Root cause (recap)

`app/page.tsx:133` passes a literal `achievementPercent={null}` into `KpiRow`. `KpiRow`
(`components/dashboard/KpiRow.tsx:42-62`, null branch `:55-59`) is a pure RSC that renders the
Achievements tile as the `—` `nullValue` cell whenever the prop is null. Because the prop is a
hardcoded constant, the tile is permanently `—` for **every** viewer regardless of privacy or library
contents. The real percentage **is** computed — `getAchievementProgress(steamId, appIds)`
(`server/repositories/achievements.ts`) returns `Availability<LibrarySummary>` with `result.data.percent`
— but only through a separate Suspense sibling, `AchievementSummarySection` (`app/page.tsx:153-155` →
`AchievementSummarySection.tsx:26`), which renders a lower section and **cannot** feed a prop already
rendered into `KpiRow` above it. The comment at `app/page.tsx:125-128` claims the % "streams into" the
tile, but no streaming target exists, so the "pending" state is permanent. Hours/Games/Played-recently
render fine because they come from real awaited data in the blocking payload.

## Classification & strategy

**code-fix** — a hardcoded `null` literal never wired to the already-computed value. The data layer is
healthy (`getAchievementProgress` returns a real percent when available and `unavailable` on genuine
absence), so it is not data-ops/mixed; the value is not legitimately absent for the reported user, so it
is not ux-degradation; permanent `—` for all users is plainly wrong, so it is not wont-fix.

**Strategy — give the Achievements KPI tile its own streaming boundary**, mirroring the
`LibraryValueSection` / `AchievementSummarySection` precedent:
1. In `KpiRow.tsx`, export the `KpiCell` primitive and add a pure presenter `AchievementKpiCell({ percent: number | null })` that renders `value%` for a number and the existing `—` `nullValue` cell for null; refactor `KpiRow` to accept an `achievements: ReactNode` slot as the 4th grid cell, keeping the single `divide-x`/border grid container.
2. New module `components/dashboard/AchievementKpiSection.tsx` — async server wrapper that awaits `getAchievementProgress` and maps `result.available ? result.data.percent : null`, plus a synchronous `AchievementKpiSkeleton` (own module per **ERR-0006** so homepage tests can stub it).
3. In `app/page.tsx`, remove `achievementPercent={null}`; supply the Achievements slot as `<Suspense fallback={<AchievementKpiSkeleton/>}><AchievementKpiSection steamId={featuredId} appIds={achievementAppIds} /></Suspense>`, reusing the already-computed `achievementAppIds`/`featuredId`. Keep the aggregate OUT of the blocking `Promise.all` (preserves the ~38s budget, **ERR-0003**).
4. Update the misleading comment at `app/page.tsx:125-128`.

**Why it beats alternatives:** hoisting/awaiting the aggregate in the blocking path blows the ~38s cold
load budget (ERR-0003); a client refetch is impossible (RSC + server-only Steam access). The deferred-tile
pattern is already trusted in this codebase. A genuine `null` still degrades to a designed `—` honest
state, **never a fabricated 0%**.

### Decision — double fan-out (resolved the sole round-1 open question)

Keeping the tile's own Suspense boundary means both it and the lower `AchievementSummarySection` call
`getAchievementProgress(steamId, sameAppIds)` in one render. The `server/cache.ts` single-flight map
(`inFlight`, `:36-110`) + shared `TTL.playerAchievements` collapse this to **a single Steam fan-out per
render**. This dedup is a **pre-existing contract** (already proven by
`tests/unit/cache-single-flight.test.ts`), **not** a behavior introduced by this fix — so it is **not** an
acceptance criterion and gets **no** red-first test (such a test would pass today and is forbidden). It is
documented under regression risks as reliance on an existing, separately-tested primitive. (Sharing one
resolved value across both boundaries was rejected: it requires awaiting in the blocking payload — ERR-0003
— or one Suspense child feeding another's prop, the exact impossibility named in the root cause.)

## Files to change

| File | Edit | Rationale |
|---|---|---|
| `components/dashboard/KpiRow.tsx` | Export `KpiCell`; add pure presenter `AchievementKpiCell({ percent })` (number → `value%`, null → existing `—` nullValue cell); refactor `KpiRow` to take an `achievements: ReactNode` slot as the 4th cell, preserving the single grid container + divide-x/border so pending/unavailable/resolved cells are pixel-identical. | A per-tile Suspense boundary is impossible while cells render inline; exporting the cell + slot enables it without re-fetch; the pure presenter is unit-testable without the RSC renderer. |
| `components/dashboard/AchievementKpiSection.tsx` *(new)* | Async server wrapper `AchievementKpiSection({ steamId, appIds })` awaits `getAchievementProgress` → `<AchievementKpiCell percent={result.available ? result.data.percent : null} />` (null on unavailable, **never 0**). Export synchronous `AchievementKpiSkeleton` (same `—` nullValue cell, `aria-busy`) for the Suspense fallback. Mirror the ERR-0006 own-module doc-comment. | Reuses the proven repository call; own-module convention lets homepage tests stub it; the available→percent / unavailable→null mapping is the load-bearing, function-level-testable logic. |
| `app/page.tsx` | Remove `achievementPercent={null}` (~:133); render `KpiRow` with the 3 static cells + the Achievements slot as `<Suspense fallback={<AchievementKpiSkeleton/>}><AchievementKpiSection steamId={featuredId} appIds={achievementAppIds} /></Suspense>`. Keep the aggregate out of the blocking `Promise.all`. Rewrite the `:125-128` comment. | The literal bug site, where the bounded `appIds` + `steamId` already exist. |

## Tests (red-first → acceptance criteria)

| Test file | Asserts | Proves AC | Red-first condition (fails today) |
|---|---|---|---|
| `tests/unit/KpiRow.test.tsx` | `AchievementKpiCell` with `percent={42}` → `42%` (not `—`); `0` → `0%` (honest real zero); `null` → `—` cell, no `%`. `KpiCell` is importable. | AC1 | `AchievementKpiCell` and the `KpiCell` export **do not exist** today → import fails. Targets NEW exports, not KpiRow's already-green non-null branch. |
| `tests/unit/achievement-kpi-section.test.tsx` | `const el = await AchievementKpiSection({steamId,appIds})`, render the returned **sync** JSX: MSW available fixtures → real `%`; MSW all-private/no-achievement → `—`, never `0%`/number. (We await the component ourselves, render only its sync return → ERR-0006-safe.) | AC2 | `AchievementKpiSection` **does not exist** today → import/await fails. The load-bearing assertion that wiring maps real data → tile, which the hardcoded null never did. |
| `tests/unit/page-wiring.test.ts` | Static source assertion on `app/page.tsx`: no longer contains literal `achievementPercent={null}`, and references `AchievementKpiSection` wrapped in a `Suspense` fallback of `AchievementKpiSkeleton`. | AC3 | Today `app/page.tsx` literally contains `achievementPercent={null}` and no `AchievementKpiSection` reference → fails today for the right reason. (Behaviorally backstopped by AC2; keep matchers loose to avoid brittleness.) |

**Acceptance criteria:** (1) non-null percent → tile renders the percentage, null → designed `—` honest
state; (2) wrapper maps available→real percent / unavailable→`—`, never fabricated 0%; (3) page wires the
boundary to `getAchievementProgress` and no longer hardcodes null. Each maps 1:1 to a test above.

## Data-ops actions

**None** — fully code-determined.

## Shared files, dependencies & non-negotiables

- **Shared:** `server/repositories/profile.ts` is **read only** here (not modified), but is a declared shared file with **bug-02** (which *does* modify it) → serialize.
- **Dependencies:** none on other bugs' logic.
- **Non-negotiables engaged:** degrade-never-fabricate (unavailable → `—`, never 0%; a real computed 0% is allowed only when actually returned); Steam access only via the repository (no inline fetch); server-only async component (no `NEXT_PUBLIC_`); `steamId` stays a string; test-first with no load-bearing assertion through `render(await HomePage())` (**ERR-0006**); the round-1 forbidden green dedup test was **removed**, not kept.

## Blast radius / rollback / regression risks

- **Blast radius:** dashboard KPI row only — `app/page.tsx`, `KpiRow.tsx`, new `AchievementKpiSection.tsx`. `homepage.test.tsx` and `homepage-stale.test.tsx` must add a `vi.mock` **stub** for the new async section (mirroring the existing `AchievementSummarySection` stub) — stub-only edits, not new assertions.
- **Rollback:** revert the two files + delete the new module + revert the test stubs. Clean git revert; no data/migration/runtime side effects.
- **Regression risks:** (1) layout shift if the cell leaves the shared grid — mitigate by one grid container + reusing `KpiCell`; (2) homepage tests throw the ERR-0006 error unless the new section is stubbed; (3) double fan-out relies on the pre-existing single-flight primitive (no new test); (4) `page-wiring.test.ts` is source-text-based — keep matchers loose.

## Open questions

None (the round-1 open questions on double fan-out and the unavailable-vs-pending state were resolved into
decisions during the revision: dedup relies on the existing primitive; both pending and unavailable reuse
the single `—` `nullValue` cell, consistent with the dense KPI design — the verbose explanation lives in
the lower `AchievementSummary` EmptyState).

## Reviewer notes

Approved after independent line-by-line re-verification (grep-confirmed `achievementPercent={null}` at
`:133`; confirmed `KpiCell` is a non-exported local fn so test #1 reds at import; confirmed `inFlight`
single-flight at `cache.ts:36/95/112`, so the documented dedup reliance is truthful). All 7 round-1
required changes genuinely addressed. **Non-blocking nit:** test #3 is source-text-based — its behavioral
substance is backstopped by test #2, so the AC does not rest on a string match alone; keep its matchers
loose.
