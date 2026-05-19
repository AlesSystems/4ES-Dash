# Claude MCP Servers

This repo ships a project-scoped `.mcp.json` at the root, committed to git.
It declares Model Context Protocol servers that Claude Code will offer in
any session opened in this repository. Secrets are referenced via `${VAR}`
substitution — set them in your shell or `.env` before launching Claude.

## Active servers

### `github`

- **Package**: `@modelcontextprotocol/server-github` (run via `npx`)
- **Env required**: `GITHUB_PERSONAL_ACCESS_TOKEN`
- **Scopes needed**: `repo`, `read:org`, `read:user`. For private workflow
  inspection also enable `workflow`.
- **Why**: PRs, issues, Actions runs, file/commit lookup. Lets Claude open
  PRs, comment on issues, and read CI status without shelling out to `gh`.
- **Setup**:

  ```sh
  export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx
  ```

  Generate a fine-grained token at <https://github.com/settings/tokens?type=beta>
  scoped to `AlesSystems/4ES-Dash`.

### `context7`

- **Package**: `@upstash/context7-mcp` (run via `npx`)
- **Env required**: none.
- **Why**: fetches up-to-date docs for Next.js 14 App Router, Prisma, Zod,
  Tailwind, and shadcn/ui at code-write time. Reduces hallucinated APIs.

## Deferred servers (enable later)

These are intentionally **not** wired up yet because the code they target
doesn't exist in the repo. Add them in the PR that introduces the matching
feature.

| Server                                  | Add when…                                | Env required        |
|-----------------------------------------|------------------------------------------|---------------------|
| `@modelcontextprotocol/server-postgres` | Prisma + Postgres land (Phase 1)         | `DATABASE_URL`      |
| `@playwright/mcp`                       | Playwright E2E tests land (Phase 2)      | none                |
| `@sentry/mcp-server`                    | Sentry is wired (CLAUDE.md says optional)| `SENTRY_AUTH_TOKEN` |
| Vercel MCP                              | Deploying to Vercel and want logs in chat | `VERCEL_TOKEN`     |

When you enable one, append it to `.mcp.json`, add the env var to
`.env.example`, and update this file.

## How `.mcp.json` is resolved

Claude Code reads `.mcp.json` at session start. Servers are launched on
demand the first time the model invokes one of their tools. The `${VAR}`
syntax is substituted from your shell environment — Claude does not read
`.env` itself, so export the variable or source `.env` before `claude`:

```sh
set -a; . ./.env; set +a
claude
```

## Disabling a server locally

There is no per-server disable in `.mcp.json` itself. To opt out for one
checkout, override the config in `~/.claude.json` (user scope) or simply
unset the env var — the server will still be advertised but will fail on
first call.

## Security notes

- `.mcp.json` is committed. Never embed a real token in it — always use
  `${VAR}` substitution.
- The GitHub token should be **fine-grained**, repo-scoped, with the
  minimum required permissions. Rotate quarterly.
- The Postgres MCP, when enabled, will execute arbitrary SQL. Use a
  read-only role in `DATABASE_URL` for analytical sessions; full DB user
  only when migrations are explicitly the task.
