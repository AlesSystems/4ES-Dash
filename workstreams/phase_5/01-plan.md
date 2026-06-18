# Plan — Phase 5: Polish & Ship

> Orchestrator-authored from [00-brief.md](00-brief.md) and the open `phase:5`
> issues ([#41](https://github.com/AlesSystems/4ES-Dash/issues/41),
> [#42](https://github.com/AlesSystems/4ES-Dash/issues/42),
> [#43](https://github.com/AlesSystems/4ES-Dash/issues/43),
> [#46](https://github.com/AlesSystems/4ES-Dash/issues/46)). Docker (#44) shipped;
> Vercel one-click (#45) is deferred to Phase 7 and is out of scope.

## Where we start (current state, not greenfield)

The scaffold is feature-complete (Phases 0–4) and more mature than a from-scratch
build. Before planning, the orchestrator audited the tree:

- **Skeletons:** every route already has a geometry-matched route-level
  `loading.tsx` (`app/loading.tsx`, `app/library/loading.tsx`, …). Only
  `app/page.tsx` has an **inner** section-level `<Suspense>` boundary
  (`LibraryValueSection`). There is **no shared `Skeleton` primitive** — every
  fallback hand-rolls `animate-pulse` divs.
- **Errors:** only a single root `app/error.tsx` exists. There is **no per-route
  `error.tsx`**, **no `global-error.tsx`**, and **no reusable client error
  boundary** for client trees. The root boundary already has a working `reset()`
  "Try again" button and never prints a stack trace.
- **Degradation:** `EmptyState`, `StaleBanner`, `UnavailableState` exist and pages
  already degrade private/missing data to designed states. Phase 5 must **not**
  regress this — error boundaries/skeletons must never fabricate or zero-fill.
- **Metadata/SEO:** `app/layout.tsx` sets only `title`/`description`. No
  `viewport`, no `themeColor`, no `metadataBase`, no per-route metadata.
- **Charts:** Tremor charts (`PlaytimeChart`, `GenreChart`) render inline.

So Phase 5 is a **targeted polish layer**, not a rewrite: add the missing
primitive, fill the error-boundary gaps, push independent async sections behind
Suspense, raise the Lighthouse bar, and finish the docs.

## Approach

Three PRs grouped by dependency tier (per the CLAUDE.md orchestration workflow),
plus one independent docs PR that runs in parallel:

- **PR1 — Skeletons + Error boundaries (#41, #42).** Ship the shared primitives
  first (they are the contract everything imports), then the error boundaries and
  section-level Suspense on top. Tasks **01 → 02, 03**.
- **PR2 — Lighthouse / SEO / a11y / perf (#43).** Branches off PR1 once merged so
  the metadata edits rebase cleanly onto the Suspense changes. Task **04**.
- **PR3 — Documentation pass (#46).** Touches only `README.md`, `docs/**`, and
  `scripts/**` — zero overlap with the code PRs — so it runs **concurrently** with
  PR1 in an isolated git worktree. Task **05**.

## Sequencing & parallelism

```
        ┌─ PR3 / Task 05 (docs)  ── isolated worktree, runs in parallel ──────────┐
main ───┤                                                                          │
        └─ PR1: Task 01 (primitives) ─→ Task 02 (error boundaries)                 │
                                     └─→ Task 03 (section Suspense + CLS test)      │
                                          │                                         │
                                          ▼ (PR1 merged)                            │
                                     PR2: Task 04 (lighthouse/seo/a11y/perf)        │
```

- **Why 01 is the serialized contract:** the `Skeleton` primitive and the
  reusable error fallback are imported by tasks 02, 03, and 04. They ship and go
  green before any consumer builds against them. `components/index.ts` (the
  barrel) is a merge point — task 01 owns the additions to it.
- **Why 02 and 03 are not run as two simultaneous agents in one tree:** the
  PostToolUse gate runs `tsc --noEmit` over the whole project on every `Edit`.
  Two agents editing the same working tree concurrently can make each other's
  `tsc` transiently fail on a half-written file. They touch disjoint files
  (`error.tsx` vs `page.tsx`) but share `tsc`, so the orchestrator runs them
  **sequentially** within PR1. Task 05 is safe to parallelize because it edits no
  `*.ts`/`*.tsx` (no `tsc` interaction) and lives in its own worktree/branch.

## Agent roles

- **Implementers** — `claude-sonnet-4-6`, one task file each, test-first (TDD).
  They make no architecture calls; an ambiguous task is reported back, not
  guessed. They set their task to `in-review` in `state.json` when green locally.
- **Reviewers** — `claude-sonnet-4-6` (high-effort, adversarial), read-only,
  separate context. They audit the diff against the task's acceptance criteria +
  the DoD + `docs/*`, run the tooling, and return `VERDICT: APPROVE | REJECT`.
- **Orchestrator (this session)** — writes the plan/tasks, dispatches agents,
  owns all git (branch/commit/push), runs the CI-parity gate, opens PRs. **Does
  not self-merge** — per the DoD, only the human (`Altan Esmer`) merging a PR
  marks a task `done`.

## CI-parity gate (run by the orchestrator before each PR)

```bash
pnpm install --frozen-lockfile
cp .env.ci .env
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Risks & mitigations

- **Lighthouse ≥ 90 is not fully CI-deterministic.** A live score needs a running
  prod server + headless Chrome + real Steam data (the maintainer's
  `STEAM_API_KEY`/`STEAM_ID`). Task 04 ships the tooling (`lighthouserc.json`,
  `pnpm lighthouse` script), the metadata/a11y/perf fixes that move the score, and
  deterministic unit checks (metadata presence, no hardcoded hex, charts
  lazy-loaded). The final ≥ 90 sign-off is a **maintainer step** recorded in the
  PR description — the brief already frames it that way ("recorded scores go in
  the PR description").
- **Screenshots (#46) need a running app with real data.** The agent builds the
  README/docs structure and a `docs/screenshots/` placeholder + capture
  instructions; the actual PNGs are captured by the maintainer (cannot be
  fabricated). The link-check (deterministic) still gates.
- **Section Suspense scope creep.** Limit task 03 to pages with genuinely
  independent async sections; do not refactor pages where a single gating fetch
  legitimately uses the route-level `loading.tsx`.

## Definition of done (per task)

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` green; every acceptance
criterion covered by a regression-failing test; reviewer `VERDICT: APPROVE`;
Conventional Commit linking the issue; docs synced; the human merges.
