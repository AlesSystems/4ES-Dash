#!/usr/bin/env node
// Per-route JS bundle-size gate. Parses the Next.js App Router build manifest,
// gzip-measures the JS chunks each route ships, and fails (exit 1) if any route
// exceeds the budget. Enforces the "< 200 KB JS gzipped per route" budget from
// CLAUDE.md — run after `next build` so `.next/` exists.
//
// Usage: node scripts/check-bundle-size.mjs
// Tune the budget with BUNDLE_BUDGET_KB (default 200).

import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const NEXT_DIR = '.next';
const BUDGET_KB = Number(process.env.BUNDLE_BUDGET_KB ?? 200);
const BUDGET_BYTES = BUDGET_KB * 1024;

const manifestPath = join(NEXT_DIR, 'app-build-manifest.json');

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch {
  console.error(`✗ Could not read ${manifestPath}. Run \`pnpm build\` before the bundle check.`);
  process.exit(1);
}

const pages = manifest.pages ?? {};

// gzip each chunk once; many routes share webpack.js / main-app.js.
const gzipCache = new Map();
function gzipSize(relPath) {
  if (gzipCache.has(relPath)) return gzipCache.get(relPath);
  let size = 0;
  try {
    const abs = join(NEXT_DIR, relPath);
    if (statSync(abs).isFile()) {
      size = gzipSync(readFileSync(abs)).length;
    }
  } catch {
    size = 0;
  }
  gzipCache.set(relPath, size);
  return size;
}

const rows = Object.entries(pages)
  .map(([route, chunks]) => {
    const jsChunks = chunks.filter((c) => c.endsWith('.js'));
    const bytes = jsChunks.reduce((sum, c) => sum + gzipSize(c), 0);
    return { route, bytes };
  })
  .sort((a, b) => b.bytes - a.bytes);

const kb = (b) => (b / 1024).toFixed(1).padStart(7) + ' KB';
const over = rows.filter((r) => r.bytes > BUDGET_BYTES);

console.log(`\nPer-route JS bundle (gzipped) — budget ${BUDGET_KB} KB\n`);
for (const r of rows) {
  const flag = r.bytes > BUDGET_BYTES ? '  ✗ OVER' : '';
  console.log(`  ${kb(r.bytes)}  ${r.route}${flag}`);
}

if (over.length > 0) {
  console.error(`\n✗ ${over.length} route(s) exceed the ${BUDGET_KB} KB budget:`);
  for (const r of over) console.error(`    ${r.route} — ${kb(r.bytes).trim()}`);
  process.exit(1);
}

console.log(`\n✓ All ${rows.length} routes within the ${BUDGET_KB} KB budget.\n`);
