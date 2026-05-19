#!/bin/sh
# PreToolUse / Bash — enforce pnpm. Block npm install/add and yarn install/add.
# Allow `npm run …` (pnpm aliases it), `npx`, and `pnpm dlx`.

set -eu

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
else
  echo "[block-npm-yarn] jq not found — hook skipped. Install jq (brew install jq) for enforcement." >&2
  exit 0
fi

[ -z "$cmd" ] && exit 0

# Normalize whitespace and pad with spaces so case patterns can match word boundaries.
norm=" $(printf '%s' "$cmd" | tr -s ' \t\n' ' ') "

case "$norm" in
  *" npm install"*|*" npm i "*|*" npm add "*|*" npm uninstall "*|*" npm remove "*|*" npm ci "*|*" npm update "*)
    echo "[block-npm-yarn] This project uses pnpm. Use 'pnpm install', 'pnpm add <pkg>', 'pnpm remove <pkg>' instead." >&2
    echo "See CLAUDE.md → Planned commands." >&2
    exit 2
    ;;
  *" yarn install"*|*" yarn add "*|*" yarn remove "*|*" yarn upgrade"*)
    echo "[block-npm-yarn] This project uses pnpm. Use the pnpm equivalent of '$cmd'." >&2
    echo "See CLAUDE.md → Planned commands." >&2
    exit 2
    ;;
esac

exit 0
