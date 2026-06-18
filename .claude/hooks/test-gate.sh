#!/bin/sh
# PostToolUse / Edit|Write — THE UNFAKEABLE GATE.
#
# Closes the loop after every code change: runs the vitest tests related to the
# changed file, then a full `tsc --noEmit`. Exits 2 (blocking) on red so the
# agent that made the change is forced to confront the failure instead of
# proceeding on confidence. Ground truth is tooling, never an opinion.
#
# Scope: only TypeScript sources (*.ts / *.tsx). Docs, JSON, CSS, prisma schema,
# etc. are out of scope and pass through untouched.
#
# To disable locally (e.g. a large refactor where you want to batch checks),
# comment out the test-gate.sh entry in .claude/settings.json — see docs/HOOKS.md.

set -eu

input="$(cat)"

if ! command -v jq >/dev/null 2>&1; then
  echo "[test-gate] jq not found — gate SKIPPED. Install jq (brew install jq) to enforce the test/type gate." >&2
  exit 0
fi

file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
[ -z "$file_path" ] && exit 0

# Only gate TypeScript sources. Everything else passes through.
case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
rel="${file_path#"$repo_root"/}"

echo "[test-gate] Gating $rel — related tests + typecheck…" >&2

# 1) Related tests. A test file is run directly; a source file runs whatever
#    tests import it (transitive). No related tests found => vitest exits 0
#    (a brand-new untested file does not block here; TDD discipline is enforced
#    by the implementer agent + DoD, the type check below still runs).
case "$rel" in
  tests/* | *.test.ts | *.test.tsx | *.spec.ts | *.spec.tsx)
    if ! pnpm exec vitest run "$rel" >&2; then
      echo "[test-gate] BLOCK: tests failed for $rel. Fix red before continuing — do not proceed on confidence." >&2
      exit 2
    fi
    ;;
  *)
    if ! pnpm exec vitest related "$rel" --run >&2; then
      echo "[test-gate] BLOCK: related tests failed for $rel. Fix red before continuing." >&2
      exit 2
    fi
    ;;
esac

# 2) Whole-project type check — catches cross-module breakage related tests miss.
if ! pnpm exec tsc --noEmit >&2; then
  echo "[test-gate] BLOCK: tsc --noEmit failed. Type errors must be zero before continuing." >&2
  exit 2
fi

echo "[test-gate] PASS: $rel is green (related tests + types)." >&2
exit 0
