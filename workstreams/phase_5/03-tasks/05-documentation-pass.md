# Task 05 — Documentation pass (README, DEPLOYMENT, link-check, doc sync)

**Issue:** [#46](https://github.com/AlesSystems/4ES-Dash/issues/46) · **PR:** PR3 (independent — runs in parallel in an isolated worktree)
**Owner files (no `*.ts`/`*.tsx` — zero overlap with code PRs):**
- `README.md`
- `docs/DEPLOYMENT.md`
- `scripts/check-doc-links.mjs` (new) + `package.json` `check:docs` script
- `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`,
  `docs/DATA_MODEL.md` (sync to shipped state)
- `docs/screenshots/` (placeholders + capture instructions)

## Context

This is the "a newcomer can clone, configure, and self-host from the README alone"
criterion. Docker shipped (#44); Vercel one-click is **deferred to Phase 7** — do
**not** add a Deploy-to-Vercel badge or a Vercel section. Read the existing
`docs/DEPLOYMENT.md` (if present) and `docs/CONTRIBUTING.md` for tone/setup, and
`.env.example` for the authoritative env-var list.

## Acceptance criteria

1. **`README.md`** contains: project description; prerequisites (Node, pnpm,
   Steam API key); local setup (`pnpm install`, `.env` config via `cp .env.example
   .env`, `pnpm prisma migrate dev`, `pnpm dev`); a homepage screenshot and a
   library screenshot (referenced from `docs/screenshots/`); and a link to
   `docs/DEPLOYMENT.md`.
2. **`docs/DEPLOYMENT.md`** documents the **local** and **Docker** paths with every
   required env var (`STEAM_API_KEY`, `STEAM_ID`, `DATABASE_URL`, `CRON_SECRET`)
   and their meaning. **No Vercel section** (Phase 7).
3. **Link-check:** `scripts/check-doc-links.mjs` (Node, no new deps) resolves every
   relative link in `README.md` and `docs/**/*.md` and exits non-zero on any
   broken link; wired as `pnpm check:docs`. Running it passes on the final tree.
4. **Doc sync:** `docs/ARCHITECTURE.md`, `API.md`, `BACKEND.md`, `FRONTEND.md`,
   `DATA_MODEL.md` reflect the shipped Phases 0–4 state — remove/мark
   "planned-but-unshipped" references (e.g. anything describing Phase 5/6 as
   future that is now done, or features explicitly descoped). Do not invent new
   content; correct stale claims only.
5. **Screenshots:** add `docs/screenshots/` with a short README explaining how to
   capture `home.png` and `library.png` (run the app with real Steam data). Real
   PNGs are a maintainer step — reference them so the README renders once captured;
   flag clearly in the PR body that they are pending capture.

## Notes / guardrails

- Markdown/scripts only — this task must not edit any `*.ts`/`*.tsx`, so it never
  trips the code test-gate and is safe to run concurrently with PR1.
- Keep links relative and correct so `check:docs` passes deterministically.
- Conventional Commit `docs: …`; this PR `Closes #46`.
