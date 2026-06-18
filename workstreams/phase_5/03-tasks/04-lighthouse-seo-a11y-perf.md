# Task 04 — Lighthouse ≥ 90: SEO, a11y, perf

**Issue:** [#43](https://github.com/AlesSystems/4ES-Dash/issues/43) · **PR:** PR2 · **Tier:** 3 (after PR1 merged)
**Owner files:**
- `app/layout.tsx` (metadataBase, viewport, themeColor, defaults)
- `app/**/page.tsx` (add `export const metadata` only — PR1's Suspense work is
  already merged, so this rebases cleanly)
- chart lazy-load wrappers for Tremor (`components/history/PlaytimeChart.tsx`,
  `components/insights/GenreChart.tsx`, and their call sites)
- `lighthouserc.json` (new), `package.json` (add `lighthouse` script + devDep)
- tests under `tests/unit/`

> Test-first where the criterion is deterministic. The live Lighthouse score is a
> maintainer step (see criterion 5) — do not block the task on a headless-Chrome
> run in CI.

## Context

`app/layout.tsx` sets only `title`/`description`; there is no `viewport`,
`themeColor`, `metadataBase`, or per-route metadata, and Tremor charts render
inline (chart JS in the initial bundle). `eslint-plugin-jsx-a11y` is already a
devDep. The route bundle budget (`pnpm check:bundle`, < 200 KB gz) already exists.

## Acceptance criteria

1. **Metadata / SEO:** `app/layout.tsx` exports `metadataBase` + sensible default
   `title`/`description` (and a `viewport`/`themeColor` export per Next 14). Each
   `page.tsx` exports a route-specific `metadata` (unique title + description).
   - Test: assert each route's `metadata.title` is present and unique; assert a
     `viewport`/`themeColor` is exported from layout.
2. **a11y:** every `<main>` has an accessible heading; icon-only controls have
   `aria-label`; `jsx-a11y` rules are active in the ESLint config and `pnpm lint`
   passes with them on. No token regressions (no hardcoded hex).
   - Test/lint: `pnpm lint` green with `jsx-a11y` recommended rules enabled; a unit
     check that key icon-only buttons expose an accessible name.
3. **Perf:** Tremor charts are lazy-loaded via `next/dynamic` with a `Skeleton`
   placeholder so chart JS is not in the initial route bundle; `pnpm check:bundle`
   stays under budget for `/`, `/library`, `/history`, `/game/[appId]`.
   - Test: charts are imported via `next/dynamic` (not a static import at the page
     module top level); bundle check passes.
4. **Lighthouse tooling:** add `lighthouserc.json` asserting Performance,
   Accessibility, Best-Practices, SEO ≥ 0.9 for `/`, `/library`, `/game/[appId]`,
   and a `pnpm lighthouse` script (`lhci autorun` or `lighthouse` CLI against
   `pnpm build && pnpm start`). Document the run procedure in the PR body.
5. **Live score (maintainer step):** the actual ≥ 90 across all four categories is
   recorded in the PR description by running the tooling against a prod build with
   real Steam data. The agent prepares everything needed; it does not need a green
   live run inside the test-gate.
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.

## Notes / guardrails

- Do not add features or change data flow — polish only.
- `{ ssr: false }` dynamic charts must still render a matched `Skeleton` so there
  is no CLS and no JS-disabled blank.
- If enabling `jsx-a11y` surfaces real violations, fix them (don't disable rules).
  Log any genuine bug fixed as `ERR-XXXX` in `docs/ERROR.md`.
- When green, set `04` to `in-review` in `state.json` and report back. No PR.
