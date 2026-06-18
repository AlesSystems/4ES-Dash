/**
 * Shared helper — validates that a steamId is present before any repository
 * function proceeds with I/O.
 *
 * Rule (Task 04 — repository signature rule):
 *   - Every repository function takes `steamId: string` as its first argument.
 *   - A blank/missing steamId is a TYPED error, never a silent getEnv().STEAM_ID fallback.
 *   - `getEnv().STEAM_ID` lives ONLY at call sites (pages/routes/jobs) as the
 *     dev/featured-profile default — never inside server/repositories/**.
 */

export class MissingSteamIdError extends Error {
  constructor(context?: string) {
    super(
      context
        ? `steamId is required but was blank or missing (context: ${context})`
        : 'steamId is required but was blank or missing',
    );
    this.name = 'MissingSteamIdError';
  }
}

/**
 * Asserts that `id` is a non-empty string.
 * Throws `MissingSteamIdError` if blank or nullish — never falls back to env.STEAM_ID.
 *
 * @param id - The steamId to validate.
 * @param context - Optional description of the call site (for error messages).
 * @returns The validated, unchanged `id` string.
 */
export function requireSteamId(id: string | undefined | null, context?: string): string {
  if (!id || id.trim() === '') {
    throw new MissingSteamIdError(context);
  }
  return id;
}
