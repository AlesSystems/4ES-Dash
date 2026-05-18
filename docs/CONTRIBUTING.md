# Contributing

This is a personal project, but it's open to PRs. Keep changes focused and the bar high.

## Getting set up

```bash
git clone git@github.com:alessystems/4es-dash.git
cd 4es-dash
pnpm install
cp .env.example .env
# fill in STEAM_API_KEY and STEAM_ID
pnpm prisma migrate dev
pnpm dev
```

Open http://localhost:3000.

## Branching

- Branch from `main`.
- Use a descriptive name: `feat/library-grid`, `fix/cache-key-collision`, `docs/architecture`.
- Keep branches short-lived. Rebase, don't merge `main`.

## Commits

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Subject in the imperative, ≤ 72 chars. Body explains *why*, not *what*.
- One logical change per commit. Squash noise before review.

## Pull requests

- One PR per change. Smaller is better — under 400 changed lines is the target.
- Fill in the PR template: what, why, screenshots if UI, test plan.
- Link the roadmap item or issue.
- CI must be green before review.

## Code style

- TypeScript `strict: true`. No `any`. `unknown` + a narrowing function is fine.
- Prettier + ESLint enforce the rules; don't argue with the formatter.
- Imports ordered: node built-ins, external, `@/...` aliases, relative.
- File names: kebab-case for utilities, PascalCase for React components.
- Prefer named exports. Default exports only for Next.js pages/layouts.

## Definition of done

- [ ] Type-checks (`pnpm typecheck`)
- [ ] Lints (`pnpm lint`)
- [ ] Tests added/updated and passing (`pnpm test`)
- [ ] Storybook story (for new components)
- [ ] Docs updated if surface or behavior changed
- [ ] Manually exercised in the browser
- [ ] No `console.log`, no commented-out code, no TODO without an owner

## Review

- Reviewers focus on: correctness, security, simplicity, naming, missing tests, UX edges. Not style — the linter handles that.
- Authors respond to every comment. "Done" or a counter-argument; no silent ignores.
- Squash-and-merge.

## Releasing

- `main` is always deployable.
- Tagged releases (`v0.x.y`) follow SemVer. Pre-1.0, minor bumps may include breaking changes; we'll call them out.
- The changelog is generated from commits via `git-cliff`.

## Security

If you find a vulnerability, do not open a public issue. Email the maintainer instead.
