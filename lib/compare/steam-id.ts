// ---------------------------------------------------------------------------
// SteamID64 validation (Phase 3, compare two users — issue #31)
// Pure + client-safe. steamId is ALWAYS a string (never number/BigInt) —
// see CLAUDE.md: JS Number cannot hold a 17-digit 64-bit ID precisely.
// ---------------------------------------------------------------------------

/** Matches exactly 17 decimal digits after trimming surrounding whitespace. */
const STEAM_ID_RE = /^\d{17}$/;

/**
 * Returns `true` when `value` is a syntactically valid SteamID64 string:
 * exactly 17 decimal digits (leading/trailing whitespace is trimmed first).
 * Returns `false` for `null`, `undefined`, empty strings, wrong length, or
 * any non-numeric characters.
 *
 * Typed as a predicate so callers narrow `string | undefined` → `string`.
 */
export function isValidSteamId(value: string | null | undefined): value is string {
  if (value == null) return false;
  return STEAM_ID_RE.test(value.trim());
}
