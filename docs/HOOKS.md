# Claude Code Hooks

This repo ships project-scoped hooks in `.claude/settings.json` that enforce a
few high-signal conventions automatically. They run inside any Claude Code
session opened against this repository so a fresh agent can't accidentally
break our rules.

All hook scripts live in `.claude/hooks/`, are POSIX `sh`, and depend on `jq`
(install via `brew install jq` on macOS). If `jq` is missing the hooks
gracefully no-op rather than block.

## Active hooks

### 1. `block-npm-yarn.sh` — enforce pnpm

- **Trigger**: `PreToolUse` on `Bash`
- **Blocks**: `npm install`, `npm i`, `npm add`, `npm uninstall`, `npm ci`,
  `npm update`, `yarn install`, `yarn add`, `yarn remove`, `yarn upgrade`.
- **Allows**: `npm run <script>` (pnpm aliases it), `npx`, `pnpm dlx`.
- **Why**: CLAUDE.md mandates pnpm as the sole package manager. Mixed
  lockfiles are a real footgun.
- **Legit bypass**: there isn't one. Use the pnpm equivalent.

### 2. `block-migration-edit.sh` — protect committed migrations

- **Trigger**: `PreToolUse` on `Edit`
- **Blocks**: edits to `prisma/migrations/*/migration.sql` if the file already
  exists in git history.
- **Allows**: edits to migration files that exist only in the working tree
  (the normal `prisma migrate dev` loop where you regenerate before
  committing).
- **Why**: "Migrations are immutable once merged" (CLAUDE.md). Fix mistakes
  with a follow-up migration, never by rewriting history.
- **Legit bypass**: amend before commit, or generate a new migration.

### 3. `block-dangerous-bash.sh` — block obvious data loss

- **Trigger**: `PreToolUse` on `Bash`
- **Blocks**:
  - `rm -rf <path>` where any path is **outside** the safelist
    (`.next`, `node_modules`, `dist`, `build`, `coverage`, `.turbo`,
    `.cache`, `out`, `/tmp/*`).
  - `git push --force` / `-f` to `main` or `master`.
  - `prisma migrate reset` (drops the dev DB).
- **Why**: these are the genuine "I lost work" / "I dropped prod" classes.
- **Legit bypass**: run the exact command yourself in a terminal outside
  Claude. The hook only fires for tool-driven invocations.

### 4. `remind-docs.sh` — docs nudges (non-blocking)

- **Trigger**: `PostToolUse` on `Edit|Write`
- **Behavior**: prints a single-line stderr reminder when files under
  `server/`, `app/api/*/route.ts`, `prisma/schema.prisma`, `lib/steam/`, or
  `src/db/` change. Never blocks (exit 0).
- **Why**: encodes the "Documentation Rule" from CLAUDE.md without lecturing.

## Disabling hooks locally

Project-scoped settings cannot be removed, but you can override them per
checkout in `.claude/settings.local.json` (gitignored). Example — disable
all hooks for this clone only:

```json
{
  "hooks": {
    "PreToolUse": [],
    "PostToolUse": []
  }
}
```

Or replace a single matcher with an empty array to silence just one rule.

## Testing a hook

Each script reads `CLAUDE_TOOL_INPUT` JSON from stdin. Smoke-test directly:

```sh
echo '{"tool_input":{"command":"npm install foo"}}' \
  | ./.claude/hooks/block-npm-yarn.sh
# stderr: [block-npm-yarn] This project uses pnpm. …
# exit:   2  (blocked)

echo '{"tool_input":{"command":"pnpm add foo"}}' \
  | ./.claude/hooks/block-npm-yarn.sh
# exit:   0  (allowed)
```

Exit codes follow Claude Code convention: `0` = allow, `2` = block + show
stderr to the model so it can self-correct.

## Platform note

Hooks are POSIX `sh` and rely on `jq`, `git`, `sed`, `tr`. Tested on macOS.
Windows contributors should run inside WSL — native PowerShell is not
supported.

## Adding a new hook

1. Drop the script in `.claude/hooks/` and `chmod +x` it.
2. Wire it into `.claude/settings.json` under the right `matcher`.
3. Document the trigger, blocked patterns, rationale, and bypass here.
4. Add a smoke test to the PR description.
