# Task 01 — Shared UI primitives (Skeleton, RouteError, RetryBoundary)

**Issue:** prerequisite/contract for [#41](https://github.com/AlesSystems/4ES-Dash/issues/41)
+ [#42](https://github.com/AlesSystems/4ES-Dash/issues/42)
**PR:** PR1 (skeletons + errors) · **Tier:** 1 (serialized contract — runs first)
**Owner files (disjoint):**
- `components/ui/skeleton.tsx` (new)
- `components/states/RouteError.tsx` (new)
- `components/states/RetryBoundary.tsx` (new)
- `components/index.ts` (add the 3 exports — barrel merge point)
- tests under `tests/unit/components/`

> Test-first. Write a failing test for each criterion, watch it fail for the right
> reason, then implement to green. The PostToolUse gate runs related vitest + `tsc`
> on every save and **blocks on red** — do not work around it.

## Context

The repo has no shared skeleton primitive (every fallback hand-rolls
`animate-pulse` divs) and only one root `app/error.tsx`. These three primitives
are the contract Tasks 02/03/04 import. Read `app/error.tsx` (current boundary),
`components/states/UnavailableState.tsx` and `components/states/EmptyState.tsx` for
the house style, and `lib/` for the existing `cn`/class-merge helper (use it —
do not add a new one). Tokens only — no hardcoded hex (see `docs/DESIGN.md`).

## Acceptance criteria

1. **`Skeleton`** (`components/ui/skeleton.tsx`): a server-safe presentational
   component, `<div aria-hidden>` with `animate-pulse`, rounded, `bg-surface-2`
   token background, merging a caller `className` (width/height/shape). No
   `"use client"`. No hex.
   - Test: renders with `animate-pulse` + `bg-surface-2`, is `aria-hidden`, and a
     passed `className` (e.g. `h-6 w-48`) is present on the element.
2. **`RouteError`** (`components/states/RouteError.tsx`, `"use client"`): accepts
   `{ error, reset, title?, description? }`. Logs the error via `useEffect`
   (diagnostics), renders a `TriangleAlert` icon, a heading, a description, and a
   **Retry** button. Clicking Retry calls **both** `reset()` and
   `router.refresh()`. **Never** renders `error.message` or `error.stack`.
   - Test: renders default + custom title/description; clicking Retry invokes the
     `reset` spy; the rendered DOM contains neither `error.message` text nor
     `error.stack`; `router.refresh` (mock `next/navigation`) is called on Retry.
3. **`RetryBoundary`** (`components/states/RetryBoundary.tsx`, `"use client"`): a
   React error-boundary **class component** (no new dependency) that catches a
   throwing child and renders `RouteError` as fallback; its reset clears boundary
   state and calls `onReset` (default `router.refresh()`).
   - Test: a child that throws renders the fallback (Retry button visible); after
     reset with a now-non-throwing child, children render again.
4. **Barrel:** the three are exported from `components/index.ts`.
   - Test (or typecheck): `import { Skeleton, RouteError, RetryBoundary } from '@/components'` resolves.
5. `pnpm lint && pnpm typecheck && pnpm test` green. No `any`. Named exports.

## Notes / guardrails

- Match the existing `app/error.tsx` styling (token classes, focus-visible ring,
  `strokeWidth={1.75}`) so the refactor in Task 02 is a drop-in.
- Keep `SkeletonText`/`SkeletonCard` convenience wrappers **optional** — add only
  if they remove real duplication; the reviewer rejects speculative API.
- Mock `next/navigation`'s `useRouter` in tests (jsdom has no router).
- When green locally, set this task to `in-review` in `state.json` and report the
  exact files + test paths back to the orchestrator. Do not open a PR.
