# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

**Active, Phases 0–4 shipped; Phase 5 (polish/ship) and Phase 6 (multi-user auth) in flight.** The project is scaffolded and running: Next.js 14 App Router, Prisma, a rate-limited Steam client, Redis/LRU cache, snapshot jobs, and ~60 vitest suites are all in place. Treat the docs as the spec and the open GitHub issues (labelled `phase:5` / `phase:6`) as the current work; check [ROADMAP.md](ROADMAP.md) before starting.

When asked to "build X", find the matching workstream under `workstreams/` (or open one) and follow the brief → plan → tasks → implementer/reviewer loop below — do not free-hand a feature.

## Non-negotiables (the gate decides "done", not your confidence)

These are not aspirational. An external, deterministic check enforces each one; an agent's belief that code is correct counts for nothing.

- **Test-first (TDD).** Write a failing test that encodes the requirement, watch it fail for the right reason, then implement to green. No implementation before a red test. See the `superpowers:test-driven-development` skill.
- **The PostToolUse gate is law.** Every `Edit|Write` to a `*.ts`/`*.tsx` file triggers `.claude/hooks/test-gate.sh`, which runs the related vitest tests + `tsc --noEmit` and **blocks (exit 2) on red**. You cannot proceed on a failing change. Never disable or work around it (to pause it deliberately, see [docs/HOOKS.md](docs/HOOKS.md)).
- **Generator ≠ judge.** The agent that writes code never certifies it. Review comes from a *different* model in a *separate*, read-only context (`.claude/agents/reviewer.md`). Final ground truth is always tooling — tests, types, lint — never an opinion.
- **Definition of done** (all must hold before a task leaves `in-review`):
  1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all exit 0 locally.
  2. Every acceptance criterion in the task file is covered by a test that would fail if the behavior regressed.
  3. The reviewer agent returns `VERDICT: APPROVE` against the task's acceptance criteria.
  4. Docs updated per the Documentation Rule below; ERR-XXXX appended if a bug was found/fixed.
  5. The human (`Altan Esmer`) approves and merges the PR. **Only the merge marks a task `done`** — no agent sets its own task to done.
- **Never commit `STEAM_API_KEY` or any secret.** Server-only; never prefix a server var with `NEXT_PUBLIC_`. Client components hit `/api/*`, never `api.steampowered.com`.
- **Validate all Steam I/O with zod at the boundary.** Unexpected shape → `SteamApiError({ kind: "schema" })`, never silent coercion. Steam access goes only through the single rate-limited client in `lib/steam/` — never inline `fetch`.

## Agentic workflow (where features come from)

Durable state lives in files, not in an agent's context. A feature flows:

`workstreams/<feature>/00-brief.md` (you write the intent + acceptance criteria) → `01-plan.md` + `02-architecture.md` (orchestrator writes from the brief) → `03-tasks/*.md` (one independently-verifiable task each, with its own acceptance criteria) → **implementer** agent (sonnet, test-first, one task, no architecture calls) → **reviewer** agent (opus, read-only, adversarial) → green suite → your PR review. Status is tracked machine-readably in `state.json`. See [workstreams/README.md](workstreams/README.md).

## Planned commands

Once scaffolded, package manager is **pnpm** (not npm/yarn):

```bash
pnpm install
cp .env.example .env       # set STEAM_API_KEY, STEAM_ID, DATABASE_URL, CRON_SECRET
pnpm prisma migrate dev
pnpm dev                   # Next.js dev server on :3000
pnpm typecheck
pnpm lint
pnpm test                  # Vitest
pnpm test <path>           # single file
pnpm exec playwright test  # E2E
```

## Architecture in one minute

Single Next.js App Router deployment. There is no separate backend service.

- **`app/`** — RSC pages (default) + `app/api/**/route.ts` route handlers. RSCs call the data layer directly; client components fetch from `/api/*`, never directly from Steam.
- **`lib/steam/`** — the **only** code that talks to the Steam Web API. Returns Zod-parsed types. Token-bucket limited (1 req / 250 ms), retries 3x with backoff on transient errors, throws typed `SteamApiError` with `kind: "rate_limit" | "auth" | "private" | "transient" | "schema" | "unknown"`.
- **`server/`** — server-only: `db.ts` (Prisma), `cache.ts` (Redis prod / in-memory LRU dev, same interface), `repositories/`, `jobs/`, `env.ts` (Zod-parses `process.env` at boot, crashes on missing config).
- **`lib/`** — pure utilities safe to bundle to the client. Anything server-only goes in `server/`.
- **`prisma/schema.prisma`** — SQLite in dev, Postgres in prod. Two table flavors: **reference** (upserted) and **snapshot** (append-only, `(steamId, appId, date)` compound key, written with `createMany({ skipDuplicates: true })`).

Data flow: RSC page → repository → `cache(key, ttl, loader)` → `lib/steam` client → Steam Web API. The cache key namespace is `steam:<endpoint>:<steamId>[:<appid>]`. TTLs live in **one** map at `server/cache/ttl.ts` — don't sprinkle magic numbers.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture and trade-offs.

## Non-obvious conventions

These will bite if you don't know them:

- **`steamId` is a `string`, not a number or BigInt.** 17-digit 64-bit ID. JS `Number` can't hold it precisely; Prisma/SQLite BigInt support is inconsistent. Cast to string at every boundary.
- **`playtimeForever` is monotonic.** Snapshot job clamps to previous value on decrease (Steam-side corrections) and logs.
- **Snapshots are keyed by day, not hour.** Steam playtime isn't real-time anyway.
- **Every route handler is wrapped by `withErrorBoundary`.** It maps `SteamApiError` → RFC 7807, `ZodError` → 400, anything else → 500. **Don't add try/catch inside handlers** unless it produces a *different* error than the wrapper would.
- **All I/O is Zod-parsed at the boundary.** Inbound request body/query, outbound Steam responses, response payloads. If Steam returns a shape we don't expect, throw `SteamApiError({ kind: "schema" })` — never silently coerce.
- **Private Steam profiles return `{}`, not `{ games: [] }`** from `IPlayerService`. The client maps that to `SteamApiError({ kind: "private" })`.
- **Cron routes require `x-cron-secret`** compared with `crypto.timingSafeEqual`. Jobs must be idempotent (compound unique on snapshot keys).
- **Stale-while-revalidate**: if a fetch exhausts retries, the cache returns the previous value with `stale: true` for the UI to surface.
- **Data availability — degrade, never crash or fabricate.** Steam doesn't expose everything (price-paid, acquisition date, friends activity feed). Follow the free fallback ladder: official API → Store API → derive from our own snapshots → free *opt-in* enrichment (SteamSpy/IsThereAnyDeal, off by default) → explicit `unavailable`/approximate state. Data-layer functions return `{ available: false, reason }` for missing data so the UI renders a designed empty state — no thrown error reaches the user, no silent zero. See [docs/STEAM_DATA_SOURCES.md](docs/STEAM_DATA_SOURCES.md#data-availability--degradation-strategy).
- **API key is server-only.** Never prefix with `NEXT_PUBLIC_`. Client components hit `/api/*`, never `api.steampowered.com`.
- **Image src is allow-listed** to `avatars.steamstatic.com`, `media.steampowered.com`, `cdn.akamai.steamstatic.com` via CSP. No user-supplied URL hits server `fetch`.
- **Migrations are immutable once merged.** Fix mistakes with a follow-up migration, never edit an existing one.

## Frontend rules

- **RSC by default.** Only mark `"use client"` when you need state, refs, effects, or browser APIs.
- **Fetch where you render.** No client-side `fetch` to our own routes unless the data must refresh in place. No data fetching in `useEffect` for first paint — use RSC + Suspense.
- **URL state for filters/sort/pagination** (`useSearchParams` + `router.replace`). Don't reach for Zustand/Redux.
- **Tailwind tokens only.** Never hardcode hex in JSX — tokens are CSS variables in `app/globals.css`, surfaced via Tailwind in `tailwind.config.ts`.
- **shadcn/ui + Radix** for primitives, **Tremor** for charts (lazy-load below the fold), **`lucide-react`** for icons (stroke 1.75; never mix icon sets), **`next/image`** for all imagery with `sizes`.
- Performance budget per route: **< 200 KB JS gzipped**, LCP < 2.5 s on mid-tier mobile.
- Every async boundary has a skeleton matching final layout geometry (no CLS). Every list has a designed empty state.

## Skills

This repo ships two project-specific Claude skills in `.claude/skills/`:

- **`backend`** — Steam client, cache, DB, Prisma, jobs, server actions, route handlers as RSC data sources. Enforces [docs/BACKEND.md](docs/BACKEND.md) and [docs/DATA_MODEL.md](docs/DATA_MODEL.md).
- **`api`** — public `/api/*` JSON surface and Steam Web API integration. Enforces [docs/API.md](docs/API.md).

Trigger them proactively when the work matches.

> Design and frontend concerns are governed by [docs/DESIGN.md](docs/DESIGN.md) and [docs/FRONTEND.md](docs/FRONTEND.md) (plus the available `design`/`frontend-design` plugin skills). The earlier project-specific `design`/`frontend` skills were removed as duplicates — don't reference them.

## Code style essentials

- TypeScript `strict: true`. No `any` — use `unknown` + a narrowing function.
- Named exports. Default exports only for Next.js pages/layouts.
- File names: kebab-case for utilities, PascalCase for React components.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). Subject ≤ 72 chars, imperative.
- Branches: `feat/...`, `fix/...`, `docs/...`. Rebase, don't merge `main`.

## Doc map

- [ROADMAP.md](ROADMAP.md) — phased plan; check before starting new work
- [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) — per-phase, testable acceptance criteria (what "done" means; issues link here)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, directory layout, caching/persistence strategy
- [docs/adr/](docs/adr/) — architecture decision records (the "why" behind decisions)
- [docs/API.md](docs/API.md) — public JSON API contract + RFC 7807 error catalog
- [docs/STEAM_DATA_SOURCES.md](docs/STEAM_DATA_SOURCES.md) — feature → data-source map (T1–T4) + free data-availability strategy
- [docs/BACKEND.md](docs/BACKEND.md) — Steam client, cache, DB, jobs, env vars
- [docs/FRONTEND.md](docs/FRONTEND.md) — RSC rules, styling, a11y, performance budgets
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — Prisma schema and the reasoning behind it
- [docs/DESIGN.md](docs/DESIGN.md) — tokens, type, spacing, voice
- [docs/SECURITY.md](docs/SECURITY.md) — threat model and controls
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — local, Docker, Vercel
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — DoD checklist
- [docs/ERROR.md](docs/ERROR.md) — central error log (ERR-XXXX); append every error, never delete
- [docs/HOOKS.md](docs/HOOKS.md) — Claude Code hooks (`.claude/settings.json`) and how to disable them locally
- [docs/MCP.md](docs/MCP.md) — MCP servers wired in `.mcp.json` (GitHub, Context7) and deferred ones
- [docs/design/](docs/design/README.md) — Claude Design handoff bundle: HTML/JSX page mockups (Dashboard, Library, Game Detail, Friends, Settings, Year in Review) + design chat transcripts. Reference (read transcripts first, recreate pixel-perfect) when implementing each page in Phases 1+. Prototypes, not source — excluded from build/lint/test.

## Error Logging

Every error — including agent-discovered issues — must be appended to `docs/ERROR.md` using the ERR-XXXX template. Update the index table. Never delete entries.

## Documentation Rule

Whenever you create or modify a file in `src/db/`, add or change a Server Action, or alter a core route, update the relevant file in `docs/` to reflect the change. Do not wait to be asked.

## Multi-Agent Notes

Multiple agents may work on different modules simultaneously. Do not revert unexpected changes — another agent may have made them. When delegating complex tasks, spawn sub-agents in parallel using claude-sonnet-4-6 by default.

## Orchestration & PR Automation

This is the standing workflow for delivering a roadmap phase (used for Phase 0; reuse it for later phases). The **orchestrator** is the main session; it delegates building to sub-agents and stays the integrator/verifier. The human (`Altan Esmer`) remains the contributor.

**Group work into PRs by dependency tier, not one-PR-per-issue.** Phase 0 shipped as 4 PRs: Foundation (#2,#6,#7,#8) → Steam core (#9,#10,#11) → API (#12) → Homepage (#13). Each tier merges to `main` before the next branches off it, so later work always rebases onto merged contracts.

Per-tier loop:

1. **Branch** from fresh `main`: `git checkout main && git pull && git checkout -b <type>/<slug>`.
2. **Fan out** to parallel implementation sub-agents (`claude-sonnet-4-6`), each scoped to a **disjoint file set**. Write shared "contract" files first (types, error classes, function signatures, formatters) so consumers can build against a stable import; **serialize barrels and assembly files** (e.g. `components/index.ts`, `app/page.tsx`) — they are the merge points. Give each agent its exact file list + the relevant `docs/` citations.
3. **Integrate + verify (CI-parity gate)** locally, all must exit 0:
   ```bash
   pnpm install --frozen-lockfile
   cp .env.ci .env
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
   (CI runs lint before typecheck so `next lint` generates `next-env.d.ts` first.)
4. **Commit + push per tier.** Conventional Commit, body ends with `Closes #<issues>` and the `Co-Authored-By: Claude ...` trailer. Commits are authored by the human (default git config); PRs are created through the human's `gh` — Claude never becomes the author.
5. **Open PR**: `gh pr create` with `Closes #`, the milestone, and area labels.
6. **Review sub-agent** (Sonnet) audits the diff against `docs/ACCEPTANCE.md`, the DoD, the relevant `docs/*`, and these conventions; returns BLOCKERS / NITS / VERDICT.
7. **Address findings**: fix blockers and cheap nits; **decline out-of-scope feedback with a documented rationale** (e.g. Storybook/live-Steam are Phase 1 — record the waiver as a PR comment rather than silently ignoring). Re-run the gate; push the follow-up.
8. **Auto-merge when green**: `gh pr checks <n> --watch`, then `gh pr merge <n> --squash --delete-branch`. `Closes #` auto-closes the issues.
9. Repeat for the next tier; close the milestone when `open=0`.

Hard-won conventions (these bit during Phase 0):

- **No real secrets in CI.** `server/env.ts` parses lazily/memoized (first use, not import) so `build`/tests pass on committed placeholder `.env.ci` / `.env.test`. Tests mock Steam with MSW (`onUnhandledRequest: 'error'` — no live call can slip through). Real `STEAM_API_KEY`/`STEAM_ID` are only for manual `pnpm dev`.
- **Format only the files you touched** (`pnpm exec prettier --write <files>`), never `pnpm format:write` on the whole tree — it reformats unrelated files (issue templates, others' configs) and pollutes the diff. `.prettierignore` covers `.github`, `*.yml`, `*.md`.
- **Vitest config is `vitest.config.mts`** (not `.ts`) because `vite-tsconfig-paths` is ESM-only.
- **ESLint flat-vs-legacy:** pinned ESLint 8 + `.eslintrc.json`; the `@typescript-eslint` plugin must be declared explicitly to reference its rules.

## Important Notes

- Be concise and clear when providing information to user about implementation or error faced.
- Do not create documents in base directory.
- For complex tasks, use sub-agents to implement the tasks parallel with accuracy.
- For sub-agents, use sonnet 4.6 as a default agent if not another model specifically mentioned.
- Do not get confused if there are different changes on different modules. Team is working in this team so agents work on different modules at the same time simultaneously.
- If you see sudden changes in the codebase, do not revert as different agents are running paralelly for same or different modules at the same time. 
- On Windows/PowerShell, do not use Bash heredocs (`<<EOF`); pipe PowerShell here-strings to the target command or use `-c`.
- Documentation Rule: Whenever you create or modify a file(s) in src/db, add or change a server action, or alter a core route, you MUST proactively open the corresponding markdown file in the docs/ directory and update it to reflect your changes. Do not wait for me to ask.

## When completing tasks:

1. Analyze repository structure
2. Use relevant skills from .github/skills (if exists)
3. If have any questions or uncertanity, just ask developer to clarify.

## After implementation finish:

- Write short summary text in console to inform developer what to expect from that implementation.
- Provide guidance on how to test the current phase and inform user if manual approach is needed
- Ensure .github\workflows\ci.yml test will pass as soon as I push to github: Lint check and Type Check.

## About Errors:
- Before implementing, check ERRORS.md for known failure patterns 
related to project. List any that apply before writing code.
- After fixed a bug. Now:
  1. State the root cause in one sentence
  2. Write the generalized rule that prevents this class of error
  3. Append it to ERRORS.md, can be found in each module specifically.
  4. Check if copilot-instructions.md needs updating.
- Do not just fix the symptom. Identify: (a) why this happened, (b) where else in the codebase this same assumption might be wrong, (c) what rule would have prevented it.