#!/usr/bin/env node
// Scans README.md and all docs/**/*.md for relative markdown links and image
// srcs, resolves them against the filesystem, and exits non-zero if any are
// missing. Ignores http(s):// URLs and bare anchors (#...).
//
// Usage: node scripts/check-doc-links.mjs
// Wire as:  "check:docs": "node scripts/check-doc-links.mjs"

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Collect all Markdown files to scan
// ---------------------------------------------------------------------------

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

const filesToScan = [
  join(ROOT, 'README.md'),
  ...walkDir(join(ROOT, 'docs')),
];

// ---------------------------------------------------------------------------
// Extract relative links from a Markdown file
// Returns [{ linkText, href, line }]
// ---------------------------------------------------------------------------

// Matches:
//   [text](href)            — standard inline link
//   ![alt](src)             — inline image
//   [text]: href            — reference-style link definition
// Capture group 1 is the href/src.
const LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)|^\s*\[[^\]]*\]:\s*(\S+)/gm;

function extractLinks(content) {
  const links = [];
  let m;
  while ((m = LINK_RE.exec(content)) !== null) {
    const raw = (m[1] ?? m[2]).trim();
    // Strip inline title  e.g. "path/to/file.md \"Title\""
    const href = raw.split(/\s+"/)[0].trim();
    links.push(href);
  }
  return links;
}

function isRelative(href) {
  if (href.startsWith('http://') || href.startsWith('https://')) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('mailto:')) return false;
  return true;
}

// Strip anchor suffix from a path  (docs/API.md#endpoint → docs/API.md)
function stripAnchor(href) {
  const hashIdx = href.indexOf('#');
  if (hashIdx === -1) return href;
  // If there's a path before the hash, keep just the path
  const path = href.slice(0, hashIdx);
  return path.length > 0 ? path : null; // bare anchor like "#section" → skip
}

// ---------------------------------------------------------------------------
// Check all files
// ---------------------------------------------------------------------------

const broken = [];

for (const filePath of filesToScan) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.warn(`  warn: could not read ${filePath}`);
    continue;
  }

  const rawLinks = extractLinks(content);
  const fileDir = dirname(filePath);

  for (const rawHref of rawLinks) {
    if (!isRelative(rawHref)) continue;

    const path = stripAnchor(rawHref);
    if (path === null) continue; // bare anchor — skip

    const abs = resolve(fileDir, path);
    if (!existsSync(abs)) {
      broken.push({ file: filePath.replace(ROOT + '/', ''), href: rawHref, resolved: abs.replace(ROOT + '/', '') });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (broken.length === 0) {
  console.log(`check:docs — all relative links resolve correctly (${filesToScan.length} files scanned).`);
  process.exit(0);
} else {
  console.error(`check:docs — ${broken.length} broken relative link(s) found:\n`);
  for (const { file, href, resolved } of broken) {
    console.error(`  ${file}`);
    console.error(`    link: ${href}`);
    console.error(`    resolved to: ${resolved} (not found)\n`);
  }
  process.exit(1);
}
