# Brief — Phase 5: Polish & Ship

> Authored from the `phase:5` GitHub issues and
> [docs/ACCEPTANCE.md#phase-5--polish--ship](../../docs/ACCEPTANCE.md). Normally the
> brief is the one human-written file; this draft is for the maintainer
> (`Altan Esmer`) to review and adjust before the orchestrator plans.
>
> **Scope decision:** Vercel one-click deploy ([#45](https://github.com/AlesSystems/4ES-Dash/issues/45))
> is **moved to Phase 7** and is NOT in this brief. Docker
> ([#44](https://github.com/AlesSystems/4ES-Dash/issues/44)) already shipped (issue
> closed) and is treated as a done dependency, not new work.

## Intent

Take the feature-complete dashboard (Phases 0–4) to production quality: every
async boundary loads and fails gracefully, the app clears the performance and
accessibility bar, and a newcomer can clone, configure, and self-host it from the
README alone. This is the "ship it" phase — no new user-facing features, only the
polish that makes the existing ones trustworthy.

## Acceptance criteria

> These mirror the four open `phase:5` issues. Each is checkable by a test or a
> command; they map 1:1 to tests the implementers write. Full text lives in
> [docs/ACCEPTANCE.md#phase-5--polish--ship](../../docs/ACCEPTANCE.md).

1. **Loading skeletons everywhere ([#41](https://github.com/AlesSystems/4ES-Dash/issues/41)).**
   Every page and every async data section renders a skeleton via a `<Suspense
   fallback={<Skeleton />}>` boundary (not a `useEffect`-driven loading flag) whose
   geometry — height, width, column structure — matches the loaded state. The
   skeleton-to-content transition produces **zero CLS**, verified by Lighthouse or a
   CLS-specific test.

2. **Error boundaries with retry ([#42](https://github.com/AlesSystems/4ES-Dash/issues/42)).**
   Every RSC page and every data-fetching client tree is wrapped in an error
   boundary that shows a user-facing message plus a **Retry** button; Retry
   re-attempts (router refresh or re-fetch) without a full page reload. In
   `NODE_ENV=production` no raw stack trace reaches the user. A test simulates a
   thrown error inside a boundary and asserts the fallback UI renders.

3. **Lighthouse > 90 on all categories ([#43](https://github.com/AlesSystems/4ES-Dash/issues/43)).**
   Against a production build (`pnpm build && pnpm start`), Lighthouse scores ≥ 90
   for Performance, Accessibility, Best Practices, and SEO. Accessibility ≥ 90 holds
   for at minimum `/`, `/library`, and `/game/[appId]`. Any sub-90 score blocks the
   milestone; recorded scores go in the PR description.

4. **Documentation pass ([#46](https://github.com/AlesSystems/4ES-Dash/issues/46)).**
   `README.md` contains: project description, prerequisites, local setup
   (`pnpm install`, `.env` config, `pnpm dev`), a homepage and a library screenshot,
   and a link to `docs/DEPLOYMENT.md`. `docs/DEPLOYMENT.md` covers the **local and
   Docker** paths with all required env vars. All links within `docs/` resolve (CI
   link-check). `docs/ARCHITECTURE.md`, `API.md`, `BACKEND.md`, `FRONTEND.md`, and
   `DATA_MODEL.md` reflect the final shipped state — no stale references to
   planned-but-unshipped features.

## Non-goals

- **One-click Vercel deploy button — deferred to Phase 7.** Do not add the
  Deploy-to-Vercel badge or Vercel-specific env pre-fill in this phase. The Phase 5
  docs pass (criterion 4) therefore documents only the local + Docker paths; the
  Vercel deployment section of `docs/DEPLOYMENT.md` is left for Phase 7.
- No new dashboard features, pages, or Steam endpoints — polish only.
- No Docker work; the image + compose already shipped via
  [#44](https://github.com/AlesSystems/4ES-Dash/issues/44).
- No multi-user / auth work — that is Phase 6.

## Constraints

- **Data source / availability:** none new. Reuse existing repositories and the
  designed empty / `{ available: false, reason }` states; error boundaries and
  skeletons must not fabricate or zero-fill missing data.
- **Performance budget:** < 200 KB JS gzipped per route, LCP < 2.5 s on mid-tier
  mobile, Lighthouse ≥ 90 across all four categories. Lazy-load Tremor charts below
  the fold.
- **Must honor:** RSC-by-default with Suspense for first paint (no `useEffect` data
  fetching); Tailwind tokens only (no hardcoded hex); skeletons match final geometry
  for zero CLS; production builds never leak stack traces. See
  [docs/FRONTEND.md](../../docs/FRONTEND.md) and
  [docs/DESIGN.md](../../docs/DESIGN.md).
- **Definition of done:** [docs/CONTRIBUTING.md](../../docs/CONTRIBUTING.md) — every
  acceptance criterion above covered by a regression-failing test; reviewer agent
  `VERDICT: APPROVE`; Conventional Commit linking the relevant issue; merge by the
  human marks each task done.
