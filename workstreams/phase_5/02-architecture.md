# Architecture — Phase 5: Polish & Ship

> Data shapes, component contracts, file ownership, and boundaries for the four
> Phase 5 tasks. Authored by the orchestrator from [00-brief.md](00-brief.md).
> Honors [docs/FRONTEND.md](../../docs/FRONTEND.md) and
> [docs/DESIGN.md](../../docs/DESIGN.md): RSC-by-default, Suspense for first paint,
> Tailwind tokens only (no hardcoded hex), zero CLS.

## New shared primitives (Task 01 — the contract)

### `components/ui/skeleton.tsx`

A single token-styled pulse primitive that all fallbacks compose, so skeleton
geometry is consistent and CLS-safe.

```ts
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string; // width/height/shape via Tailwind tokens
}
// <Skeleton className="h-6 w-48 rounded-md" />
// Renders: <div aria-hidden className="animate-pulse rounded-md bg-surface-2 …" />
```

- Pure, presentational, **server-safe** (no `"use client"`).
- Uses the existing `cn`/`clsx`+`tailwind-merge` helper (see `lib/`); never
  hardcodes hex — `bg-surface-2` token only.
- `aria-hidden` by default; the *boundary* (`loading.tsx` / Suspense fallback
  wrapper) owns the `aria-busy`/`aria-label`, not each shard.

Optional convenience exports in the same file (thin wrappers over `Skeleton`):
`SkeletonText` (line), `SkeletonCard` (cover + 2 lines) — only if it removes real
duplication; do not over-build.

### `components/states/RouteError.tsx` (`"use client"`)

The shared visual + behavior for **every** route-segment `error.tsx`. Extracted
from today's `app/error.tsx` so all boundaries are identical and retry is uniform.

```ts
export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;        // Next.js segment reset
  title?: string;           // default: "Something went wrong"
  description?: string;     // default: friendly, data-agnostic copy
}
```

Behavior contract:
- `useEffect(() => console.error(error), [error])` — diagnostics only.
- **Never** renders `error.message`/`error.stack` — no raw trace reaches the user
  in any `NODE_ENV`. (The brief requires this specifically for production; we hold
  it everywhere.)
- **Retry** button calls `reset()` **and** `router.refresh()` (`next/navigation`)
  so a transient data error re-runs the server render without a full page reload.
- Uses `TriangleAlert` (lucide, stroke 1.75), tokens only, focus-visible ring —
  matches the current `app/error.tsx` styling.

### `components/states/RetryBoundary.tsx` (`"use client"`)

A hand-rolled React error boundary **class component** (no new dependency) for
**client component trees** that can throw outside an RSC/segment boundary. Renders
`RouteError` as its fallback with a `reset` that clears boundary state and calls a
provided `onReset` (default `router.refresh()`).

```ts
export interface RetryBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}
```

> Only wrap client trees that actually fetch/throw. Most data fetching here is RSC
> (covered by `error.tsx`), so this is a small, targeted safety net — not a blanket
> wrapper. Adding it where no client tree throws is dead code; the reviewer will
> reject gratuitous use.

### Barrel (`components/index.ts`) — merge point

Task 01 adds the three new exports. No other task edits the barrel.

## Error boundary topology (Task 02)

Next.js App Router resolves the **nearest** `error.tsx` up the segment tree. Today
everything falls to the single root boundary, so an error in `/library` blows away
the whole shell. Add a boundary per top-level route segment so failures are
contained to their pane:

| File (new unless noted) | Catches errors in |
|---|---|
| `app/error.tsx` (refactor → use `RouteError`) | `/` (homepage) |
| `app/global-error.tsx` (new) | the root layout itself (last resort; renders its own `<html><body>`) |
| `app/library/error.tsx` | `/library` |
| `app/game/[appId]/error.tsx` | `/game/[appId]` |
| `app/friends/error.tsx` | `/friends` |
| `app/history/error.tsx` | `/history` |
| `app/compare/error.tsx` | `/compare` |
| `app/review/[year]/error.tsx` | `/review/[year]` |
| `app/insights/error.tsx` | `/insights/*` (covers cost-per-hour, genres, idle) |

Each is a 5-line `"use client"` default export delegating to `RouteError` with
route-appropriate copy. `global-error.tsx` must render a full document and use
inline-safe styling (it replaces the root layout when the layout itself throws).

**Do not** add `try/catch` inside route handlers or pages — `withErrorBoundary`
and these segment boundaries own error mapping (per CLAUDE.md).

## Section-level Suspense (Task 03)

Route-level `loading.tsx` already covers "every page." This task adds **inner**
`<Suspense>` boundaries so independent async sections stream individually and each
has a geometry-matched fallback built from the `Skeleton` primitive — the pattern
`app/page.tsx` already uses for `LibraryValueSection`.

Audit each page; add a boundary only where a section's fetch is **independent** of
the page's gating fetch (extract the section into an `async` server subcomponent
and wrap it). Candidates (implementer confirms by reading each page):

- **`app/page.tsx`** — already partly done; ensure achievements/recently-played
  independent sections each have a matched fallback if they fetch independently.
- **`app/game/[appId]/page.tsx`** — store metadata vs achievements are separate
  Steam calls; each becomes its own Suspense section.
- **`app/history/page.tsx`**, **`app/insights/*`** — chart data is independent of
  the page shell.
- **`app/friends/page.tsx`**, **`app/compare/page.tsx`** — wrap independent panes.

Rules: extracted subcomponents stay server components; fallbacks reuse `Skeleton`
and **match final geometry** (same heights/columns) for zero CLS; do not change
data-fetch semantics or degradation (`{ available:false }` stays a designed
state, never a thrown error).

### CLS / geometry test

A test asserting skeleton geometry matches loaded geometry (e.g. render a
`loading.tsx`/fallback and its loaded counterpart with mocked data, assert the
container dimensions/structure align). At minimum a deterministic structural
assertion; document any Lighthouse-CLS step that requires a live run.

## Lighthouse / SEO / a11y / perf (Task 04)

- **Metadata:** add `metadataBase` + richer defaults in `app/layout.tsx`; add a
  `viewport`/`themeColor` export; add per-route `export const metadata` (title +
  description) to each `page.tsx`. (This edits the same `page.tsx` files as
  Task 03 → PR2 runs after PR1 to avoid the conflict.)
- **a11y:** ensure each `<main>` has a heading, landmarks are labelled, icon-only
  buttons have `aria-label`, color contrast uses tokens, focus-visible rings
  present. Lean on `eslint-plugin-jsx-a11y` (already a devDep) — wire its rules if
  not active.
- **perf:** lazy-load Tremor charts below the fold via `next/dynamic`
  (`{ ssr: false }` with a `Skeleton` placeholder) so the chart JS is not in the
  initial route bundle; keep each route < 200 KB JS gz (the `check:bundle` script
  already exists — use it).
- **tooling:** add `lighthouserc.json` (assertions: each category ≥ 0.9 for `/`,
  `/library`, `/game/[appId]`), a `pnpm lighthouse` script, and the dev
  dependency. Document the live-run procedure; record scores in the PR body.

## Documentation pass (Task 05) — isolated, parallel

Files (no `*.ts`/`*.tsx`, so no `tsc`/test-gate interaction):

- **`README.md`** — description, prerequisites, local setup (`pnpm install`, `.env`
  config, `pnpm prisma migrate dev`, `pnpm dev`), homepage + library screenshots,
  link to `docs/DEPLOYMENT.md`.
- **`docs/DEPLOYMENT.md`** — **local + Docker** paths with every required env var
  (`STEAM_API_KEY`, `STEAM_ID`, `DATABASE_URL`, `CRON_SECRET`). **No Vercel
  section** (Phase 7).
- **`scripts/check-doc-links.mjs`** + a `pnpm check:docs` script — fails on any
  broken intra-`docs/` / README relative link (the CI link-check the brief
  requires).
- **Doc sync:** scrub `docs/ARCHITECTURE.md`, `API.md`, `BACKEND.md`,
  `FRONTEND.md`, `DATA_MODEL.md` for stale "planned but unshipped" references so
  they reflect the shipped Phases 0–4 state.
- **`docs/screenshots/`** — placeholder + capture instructions; real PNGs are a
  maintainer step (need a running app with real Steam data).

## File ownership matrix (disjoint sets prevent collisions)

| Task | Owns (creates/edits) |
|---|---|
| 01 | `components/ui/skeleton.tsx`, `components/states/RouteError.tsx`, `components/states/RetryBoundary.tsx`, `components/index.ts` (+ tests) |
| 02 | `app/**/error.tsx`, `app/global-error.tsx` (+ tests) |
| 03 | `app/**/page.tsx` (Suspense sections), new `components/**/*Section` server subcomponents, CLS test |
| 04 | `app/layout.tsx`, `app/**/page.tsx` (metadata only — after PR1), chart lazy-load wrappers, `lighthouserc.json`, `package.json` script (+ tests) |
| 05 | `README.md`, `docs/**`, `scripts/check-doc-links.mjs`, `package.json` script |

Tasks 03 and 04 both touch `page.tsx`; they are in **different PRs** (PR1 then
PR2) and never run concurrently. Task 05 is fully disjoint and runs in parallel.
