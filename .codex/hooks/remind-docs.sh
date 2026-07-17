#!/bin/sh
# PostToolUse / Edit|Write — print a single stderr reminder when files in
# documented areas change. Never blocks (always exit 0). Implements the
# "Documentation Rule" from CLAUDE.md without being noisy.

set -eu

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
else
  exit 0
fi

[ -z "$file_path" ] && exit 0

case "$file_path" in
  *server/db.ts|*server/db/*|*src/db/*)
    echo "[remind-docs] Touched DB layer — consider updating docs/DATA_MODEL.md." >&2 ;;
  *server/cache*|*server/jobs/*|*server/repositories/*|*server/env.ts)
    echo "[remind-docs] Touched server layer — consider updating docs/BACKEND.md." >&2 ;;
  *app/api/*/route.ts|*app/api/*/route.tsx)
    echo "[remind-docs] Touched a route handler — consider updating docs/API.md (contract + RFC 7807 catalog)." >&2 ;;
  *prisma/schema.prisma)
    echo "[remind-docs] Touched Prisma schema — update docs/DATA_MODEL.md to mirror the change." >&2 ;;
  *lib/steam/*)
    echo "[remind-docs] Touched the Steam client — update docs/API.md (Steam Web API integration section) and docs/BACKEND.md if behavior changed." >&2 ;;
esac

exit 0
