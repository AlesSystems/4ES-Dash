/**
 * Vitest global setup — runs once before the worker pool starts.
 *
 * Integration tests open the real SQLite database (`file:./test.db`), so the
 * schema must exist first. We replay the committed migrations against the test
 * DB here so the suite works the same locally and in CI without a separate step.
 */

import { execSync } from 'node:child_process';

export default function setup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    // Force the test database regardless of what `.env` holds. Prisma's dotenv
    // does not override an env var that is already set.
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
}
