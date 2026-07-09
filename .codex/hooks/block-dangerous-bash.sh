#!/bin/sh
# PreToolUse / Bash — block a small set of genuinely destructive commands.
# - `rm -rf` outside a safelist of build/output dirs
# - `git push --force` / `-f` to main or master
# - `prisma migrate reset` (drops dev DB, footgun in prod context)

set -eu

input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
else
  echo "[block-dangerous-bash] jq not found — hook skipped." >&2
  exit 0
fi

[ -z "$cmd" ] && exit 0

norm="$(printf '%s' "$cmd" | tr -s ' \t\n' ' ')"

# --- rm -rf guard ---------------------------------------------------------
# Match `rm -rf <path>` or `rm -fr <path>` (with optional flags interleaved).
# Allow if every path arg is inside the safelist.
case "$norm" in
  *"rm -rf"*|*"rm -fr"*|*"rm --recursive --force"*|*"rm --force --recursive"*)
    # Strip everything up to and including the rm flag cluster, then inspect args.
    # Be conservative: if we can't parse cleanly, block.
    args="$(printf '%s' "$norm" | sed -E 's/.*rm[[:space:]]+-[rfRF]+[[:space:]]+//')"
    if [ "$args" = "$norm" ]; then
      # Fallback for `--recursive --force` form
      args="$(printf '%s' "$norm" | sed -E 's/.*rm[[:space:]]+(--(recursive|force)[[:space:]]+)+//')"
    fi

    safe=1
    for p in $args; do
      case "$p" in
        # Stop scanning when we hit a shell separator
        '&&'|'||'|';'|'|') break ;;
        # Safelisted paths (relative or absolute under repo)
        .next|.next/*|node_modules|node_modules/*|dist|dist/*|build|build/*|coverage|coverage/*|.turbo|.turbo/*|/tmp/*|.cache|.cache/*|out|out/*) ;;
        # Anything else is suspicious
        *) safe=0; bad="$p"; break ;;
      esac
    done

    if [ "$safe" -ne 1 ]; then
      echo "[block-dangerous-bash] Refusing 'rm -rf $bad'." >&2
      echo "Only build/output dirs are safelisted: .next, node_modules, dist, build, coverage, .turbo, .cache, out, /tmp/*." >&2
      echo "If you really mean it, run the command manually outside Claude." >&2
      exit 2
    fi
    ;;
esac

# --- git force push to main/master ---------------------------------------
case "$norm" in
  *"git push"*"--force"*|*"git push"*" -f"*|*"git push"*" -fu"*|*"git push"*" -uf"*)
    case "$norm" in
      *" main"*|*" master"*|*":main"*|*":master"*|*"origin main"*|*"origin master"*)
        echo "[block-dangerous-bash] Refusing force-push to main/master. Force-push only to your own feature branch." >&2
        exit 2
        ;;
    esac
    ;;
esac

# --- prisma migrate reset -------------------------------------------------
case "$norm" in
  *"prisma migrate reset"*)
    echo "[block-dangerous-bash] 'prisma migrate reset' drops the dev DB. If you really want this, run it manually outside Claude." >&2
    exit 2
    ;;
esac

exit 0
