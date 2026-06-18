/**
 * next-auth catch-all route handler (App Router).
 *
 * Uses next-auth-steam which requires the incoming Request object to build the
 * correct openid.return_to / openid.realm values. Therefore authOptions is
 * constructed per-request via buildAuthOptions(req).
 *
 * Session strategy: JWT (no DB Session table) per ADR 0002.
 *
 * See: https://github.com/nekonyx/next-auth-steam#using-app-router
 */

import NextAuth from 'next-auth';
import { buildAuthOptions } from '@/server/auth';
import type { NextRequest } from 'next/server';

async function handler(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  return NextAuth(req, ctx, buildAuthOptions(req));
}

export { handler as GET, handler as POST };
