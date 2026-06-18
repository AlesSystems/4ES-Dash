/**
 * tests/unit/route-protection.test.ts
 *
 * Tests for middleware.ts — route protection via next-auth/middleware withAuth.
 *
 * Strategy: We test the `config.matcher` directly (protected paths included,
 * public paths excluded) because invoking `withAuth` in a unit test environment
 * is complex — it requires the edge runtime and reads NEXTAUTH_SECRET from env.
 * The real redirect behavior is covered by next-auth's own test suite.
 *
 * We also verify the middleware module itself imports cleanly and exports a
 * default function (the actual middleware), confirming it is correctly wired.
 */

import { beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Import the config matcher from middleware — we assert the protected paths
// are listed and the public/API paths are excluded.
// ---------------------------------------------------------------------------

// Dynamic import to avoid edge-runtime issues in node Vitest environment.
let matcherPaths: string[] = [];

describe('middleware config.matcher', () => {
  beforeAll(async () => {
    const mod = await import('@/middleware');
    // config is a named export from the middleware module
    matcherPaths = (mod.config?.matcher as string[]) ?? [];
  });

  // Protected "my" paths that must require authentication.
  // NOTE: '/' is intentionally NOT protected — it self-gates in app/page.tsx
  // (dashboard when a viewer resolves, logged-out Landing otherwise).
  const PROTECTED_PATHS = [
    '/onboarding/:path*',
    '/library/:path*',
    '/friends/:path*',
    '/history/:path*',
    '/insights/:path*',
    '/review/:path*',
    '/game/:path*',
    '/settings/:path*',
  ];

  it.each(PROTECTED_PATHS)('matcher includes protected path: %s', (path) => {
    expect(matcherPaths).toContain(path);
  });

  it('matcher does NOT include "/" (it self-gates to dashboard or landing)', () => {
    expect(matcherPaths).not.toContain('/');
  });

  // Public/API paths that must NOT be in the matcher (would block them if included)
  it('matcher does NOT include /u/:path* (public profile route)', () => {
    expect(matcherPaths).not.toContain('/u/:path*');
    // Also check no entry starts with '/u'
    expect(matcherPaths.some((p) => p.startsWith('/u'))).toBe(false);
  });

  it('matcher does NOT include /api/:path* (API routes handle auth themselves)', () => {
    expect(matcherPaths.some((p) => p.startsWith('/api'))).toBe(false);
  });

  it('matcher does NOT include /_next (Next.js internals)', () => {
    expect(matcherPaths.some((p) => p.startsWith('/_next'))).toBe(false);
  });

  it('matcher does NOT include /compare (public tool)', () => {
    expect(matcherPaths.some((p) => p.startsWith('/compare'))).toBe(false);
  });

  it('middleware exports a default function (the middleware handler)', async () => {
    const mod = await import('@/middleware');
    expect(typeof mod.default).toBe('function');
  });
});
