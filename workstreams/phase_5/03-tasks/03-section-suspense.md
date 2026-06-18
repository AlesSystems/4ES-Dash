# Task 03 — Section-level Suspense skeletons + CLS test

**Issue:** [#41](https://github.com/AlesSystems/4ES-Dash/issues/41) · **PR:** PR1 · **Tier:** 2 (after Task 01)
**Depends on:** Task 01 (`Skeleton` primitive).
**Owner files:**
- `app/**/page.tsx` — add inner `<Suspense>` boundaries (NOT metadata; that is Task 04)
- new `async` server subcomponents under `components/**` for extracted sections
- a CLS / skeleton-geometry test under `tests/unit/`

> Test-first. The gate blocks on red. **Do not touch `error.tsx` files or add
> `metadata` exports** — those belong to Tasks 02 and 04. Stay in your lane to keep
> the diff conflict-free.

## Context

Every route already has a geometry-matched route-level `loading.tsx`. This task
adds **inner** `<Suspense>` boundaries so independent async sections stream
individually, each with a fallback built from the Task 01 `Skeleton` primitive —
mirroring the pattern `app/page.tsx` already uses for `LibraryValueSection`.

## Acceptance criteria

1. **Audit + wrap independent sections.** For each page, identify async sections
   whose fetch is **independent** of the page's gating fetch, extract each into an
   `async` server subcomponent, and wrap it in
   `<Suspense fallback={<SectionSkeleton />}>`. At minimum address
   `app/game/[appId]/page.tsx` (store-metadata vs achievements are separate Steam
   calls), `app/history/page.tsx` and `app/insights/*` (chart data), and confirm
   `app/page.tsx`'s independent sections are each behind a matched fallback. Wrap
   `friends`/`compare` independent panes if present.
2. **Fallbacks reuse `Skeleton`** and **match final geometry** (same heights, widths,
   column structure) so the skeleton→content swap produces **zero CLS**.
3. **No `useEffect`-driven loading flags** introduced; first paint stays RSC +
   Suspense. Extracted subcomponents remain server components.
4. **No behavior/degradation change:** `{ available: false, reason }` stays a
   designed `UnavailableState`/`EmptyState`; private profiles still degrade; no
   fabricated/zero-filled data.
5. **CLS / geometry test:** a deterministic test that asserts a section's skeleton
   fallback and its loaded counterpart share the same structural geometry (e.g.
   same wrapper sizing classes / same number of grid items), so a regression that
   desyncs them fails. Document any Lighthouse-CLS measurement that needs a live
   run (not required to pass in CI).
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.

## Notes / guardrails

- **Scope discipline:** only split sections that are genuinely independent. If one
  gating fetch legitimately blocks the whole page, leave it to the route-level
  `loading.tsx` — do not invent Suspense boundaries for their own sake (the
  reviewer rejects gratuitous splits).
- Co-locate each `SectionSkeleton` with its section component, composed from the
  `Skeleton` primitive — do not re-hand-roll `animate-pulse` divs.
- When green, set `03` to `in-review` in `state.json` and report back. No PR.
