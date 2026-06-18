# Task 03 — add History + Friends to the sidebar (#87)

**Status owner:** implementer · **Depends on:** none · **Blocks:** none · **Tier:** 0

## Scope (exactly these files)

- `components/layout/SidebarNav.tsx` — add two `items` entries + two icon imports;
  update the stale "Friends intentionally omitted" docblock
- New `tests/unit/SidebarNav.test.tsx`

## Root cause (already traced)

Two nav components have drifted. The top app-bar nav
(`components/layout/NavLinks.tsx`) **already** lists History and Friends; the left
`SidebarNav.tsx` `items` array lists only Dashboard, Library, Insights, Year in
Review. `/history` and `/friends` are real, shipped, middleware-protected routes —
the docblock claiming Friends is "intentionally omitted" is stale.

## Acceptance criteria

1. The sidebar renders a **History** link (`href="/history"`) and a **Friends** link
   (`href="/friends"`).
2. The nav renders exactly 6 links, in order: Dashboard, Library, History, Friends,
   Insights, Year in Review.
3. When `usePathname()` returns `/history`, the History link has
   `aria-current="page"`; others do not (same for `/friends`).
4. Each item renders a single `lucide-react` icon at stroke 1.75; no other icon set
   is imported. Suggested: `LineChart`/`Clock` (History — avoid `BarChart2`/`Calendar`
   already in use), `Users`/`UserRound` (Friends).

## Degraded / unavailable-data behavior

N/A — pure nav. Add unconditionally (the sidebar renders only inside the authed shell;
both routes are guarded by `middleware.ts`), matching the `NavLinks` pattern.

## Definition of done for this task

- Failing test first (`SidebarNav.test.tsx`, mock `usePathname` per
  `ThemeToggle.test.tsx` / `UserMenu.test.tsx`); gate passes.
- `state.json` task `03` → `in-review`. Reviewer returns APPROVE.
- (Follow-up, not this task: dedupe `NavLinks` + `SidebarNav` to one `NAV_ITEMS`.)
