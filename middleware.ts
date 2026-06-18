/**
 * middleware.ts — Route protection for authenticated "my" views.
 *
 * Uses next-auth's `withAuth` helper (JWT-aware; reads NEXTAUTH_SECRET).
 * Any request to a protected path without a valid next-auth JWT token is
 * automatically redirected to /api/auth/signin.
 *
 * CSRF note: next-auth provides CSRF protection on all its state-changing auth
 * routes (/api/auth/signin, /api/auth/signout, /api/auth/callback) by default
 * via its built-in CSRF double-submit cookie pattern. No extra CSRF code is
 * needed here for the read-only data routes below.
 *
 * Paths NOT in the matcher (and therefore NOT protected):
 *   /u/:path*      — public profile pages (anyone can view, authz handled in-page)
 *   /api/:path*    — API routes handle their own auth / are public
 *   /_next         — Next.js internals
 *   /compare       — public comparison tool (no personal data)
 *   /api/auth/*    — next-auth's own routes must never be protected by withAuth
 */

import { withAuth } from 'next-auth/middleware';

// Default export: withAuth with no custom callbacks — the built-in default
// requires a valid JWT token and redirects to /api/auth/signin when absent.
export default withAuth;

export const config = {
  matcher: [
    '/',
    '/library/:path*',
    '/friends/:path*',
    '/history/:path*',
    '/insights/:path*',
    '/review/:path*',
    '/game/:path*',
    '/settings/:path*',
  ],
};
