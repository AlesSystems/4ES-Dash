#!/usr/bin/env node
/**
 * Prod-build provider switch (#86).
 *
 * The committed `prisma/schema.prisma` uses `provider = "sqlite"` so local dev
 * and CI run on a zero-setup SQLite file and the full test suite stays green.
 * Production (Vercel) runs on managed Postgres, which is provisioned schema-first
 * via `prisma db push` (the SQLite-authored migration history cannot replay on
 * Postgres, and migrations are immutable once merged — see docs/DEPLOYMENT.md).
 *
 * `prisma db push` uses the datasource provider in `schema.prisma`, so this
 * script rewrites that single line to `postgresql` at build time on the ephemeral
 * Vercel build container. It NEVER runs in dev/CI (only via the `vercel-build`
 * script) and the committed file is left untouched in version control.
 *
 * Idempotent: re-running on an already-postgres schema is a no-op.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', 'prisma', 'schema.prisma');

const original = readFileSync(schemaPath, 'utf8');

// Only touch the datasource provider line, never the generator's binaryTargets.
const updated = original.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"sqlite"/,
  '$1"postgresql"',
);

if (updated === original) {
  if (/datasource\s+db\s*\{[^}]*?provider\s*=\s*"postgresql"/.test(original)) {
    console.log('[use-postgres-schema] provider already postgresql — no change.');
    process.exit(0);
  }
  console.error('[use-postgres-schema] could not find the sqlite datasource provider to switch.');
  process.exit(1);
}

writeFileSync(schemaPath, updated);
console.log('[use-postgres-schema] datasource provider switched to postgresql for the prod build.');
