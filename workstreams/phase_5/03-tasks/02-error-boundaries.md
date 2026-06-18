# Task 02 — Route & global error boundaries with retry

**Issue:** [#42](https://github.com/AlesSystems/4ES-Dash/issues/42) · **PR:** PR1 · **Tier:** 2 (after Task 01)
**Depends on:** Task 01 (`RouteError` must exist and be exported).
**Owner files (disjoint from other tasks):**
- `app/error.tsx` (refactor to use `RouteError`)
- `app/global-error.tsx` (new)
- `app/library/error.tsx`, `app/game/[appId]/error.tsx`, `app/friends/error.tsx`,
  `app/history/error.tsx`, `app/compare/error.tsx`, `app/review/[year]/error.tsx`,
  `app/insights/error.tsx` (all new)
- tests under `tests/unit/app/` (or co-located test dir)

> Test-first. The gate blocks on red.

## Context

Today only `app/error.tsx` exists, so any route error tears down the whole shell.
Add a Next.js segment `error.tsx` per top-level route (the framework resolves the
nearest one), plus a `global-error.tsx` last-resort boundary for when the root
layout itself throws. All delegate to the shared `RouteError` from Task 01.

## Acceptance criteria

1. **Per-route boundaries exist** for every route segment in the table above; each
   is a `"use client"` default export `({ error, reset }) => <RouteError … />` with
   route-appropriate `title`/`description` (e.g. library: "Couldn't load your
   library"). No raw `error.message`/`stack` rendered.
2. **`app/global-error.tsx`** renders its own `<html><body>` (it replaces the root
   layout) and shows a minimal retry UI; no stack trace to the user.
3. **Retry** in every boundary re-attempts without a full page reload (via
   `RouteError`'s `reset()` + `router.refresh()`).
4. **Production safety:** with `NODE_ENV=production`, the fallback renders no
   `error.message`/`error.stack`. Cover with a test that passes an error carrying a
   recognizable secret string and asserts it is absent from the rendered output.
5. **Boundary renders on throw:** a test simulates a thrown error inside a boundary
   (render the `error.tsx` component directly with a fake error + `reset` spy) and
   asserts the fallback UI (heading + Retry button) renders, and that clicking
   Retry calls `reset`.
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.

## Notes / guardrails

- Do **not** add `try/catch` inside pages or route handlers — segment boundaries +
  `withErrorBoundary` own error handling (CLAUDE.md).
- Keep each `error.tsx` tiny — copy differs, behavior is centralized in
  `RouteError`. Don't duplicate logic.
- `app/insights/error.tsx` covers all three insights sub-pages (cost-per-hour,
  genres, idle) since they share the `insights` segment.
- Append an `ERR-XXXX` entry to `docs/ERROR.md` only if you discover/fix a real
  bug while doing this (per CLAUDE.md error-logging rule); otherwise no entry.
- When green, set `02` to `in-review` in `state.json` and report back. No PR.
