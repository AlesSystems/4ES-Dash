#!/bin/sh
# PreToolUse / Edit — protect already-committed Prisma migration files.
# Allows editing migrations that exist only in the working tree (mid-`prisma migrate dev`).
# Blocks edits once the migration has been committed to git history.

set -eu

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
else
  echo "[block-migration-edit] jq not found — hook skipped." >&2
  exit 0
fi

[ -z "$file_path" ] && exit 0

# Only fire for prisma migration SQL files
case "$file_path" in
  *prisma/migrations/*/migration.sql) ;;
  *) exit 0 ;;
esac

# If file has any git history, treat as committed → immutable
if git -C "$(dirname "$file_path")" log --oneline -- "$file_path" 2>/dev/null | grep -q .; then
  echo "[block-migration-edit] Migration '$file_path' is already committed and immutable." >&2
  echo "Create a follow-up migration with 'pnpm prisma migrate dev --name <fix>' instead." >&2
  echo "See CLAUDE.md → 'Migrations are immutable once merged.'" >&2
  exit 2
fi

exit 0
