import { z } from 'zod';

/**
 * Environment contract. Parsed lazily (on first `getEnv()` call), NOT at import
 * time — so `next build` and Vitest run with placeholder env and no real secrets,
 * while `pnpm dev` still fails fast on the first request if a var is missing or
 * malformed. See docs/BACKEND.md and docs/DEPLOYMENT.md.
 *
 * Secrets are server-only: none are prefixed `NEXT_PUBLIC_`.
 */
const EnvSchema = z.object({
  // 17-digit 64-bit SteamID as a string — JS Number can't hold it precisely.
  STEAM_ID: z.string().regex(/^\d{17}$/, 'must be a 17-digit SteamID string'),
  STEAM_API_KEY: z.string().min(1, 'is required'),
  // next-auth (Auth.js) — server-only secrets, never NEXT_PUBLIC_. See ADR 0002.
  // NEXTAUTH_SECRET signs/encrypts the JWT session cookie; NEXTAUTH_URL is the
  // canonical origin used to build OpenID return_to / callback URLs.
  NEXTAUTH_SECRET: z.string().min(1, 'is required'),
  NEXTAUTH_URL: z.string().url(),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  REDIS_URL: z.string().url().optional(),
  // Required in Phase 2+ (cron routes); optional during Phase 0–1 so dev needs no cron setup.
  CRON_SECRET: z.string().min(1).optional(),
  // Phase 4 free, opt-in enrichment. Both default OFF — no behaviour change and
  // no extra outbound calls unless the self-hoster explicitly turns them on.
  // SteamSpy (#38): set to '1' or 'true' to enable genre/tag/ownership enrichment.
  ENABLE_STEAMSPY: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  // IsThereAnyDeal (#39): historical-low price client is disabled unless a key is set.
  ITAD_API_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Returns the validated environment, parsing once and memoizing. Throws a clear,
 * aggregated error listing every offending variable on the first call if invalid.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
