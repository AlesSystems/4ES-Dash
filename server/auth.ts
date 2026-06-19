/**
 * next-auth configuration and server-side session helper.
 *
 * Session strategy: JWT (stateless) — no DB Session table. See ADR 0002.
 * Identity provider: Steam OpenID 2.0 via next-auth-steam (handles the
 * authorization redirect and openid.return_to/realm params correctly).
 *
 * Exports:
 *   buildAuthOptions    — per-request factory; pass the incoming Request so
 *                         next-auth-steam can build the correct return_to URL.
 *   verifySteamOpenId   — exported for testing; verifies the signed assertion
 *                         via a direct check_authentication POST to Steam.
 *   extractSteamId      — pure helper; exported for unit testing.
 *   getSessionUser      — server-side accessor for RSCs, route handlers, actions.
 */

import type { AuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { getEnv } from '@/server/env';
import { prisma } from '@/server/db';
import Steam from 'next-auth-steam';

// ---------------------------------------------------------------------------
// Steam OpenID claimed_id extraction
// ---------------------------------------------------------------------------

const STEAM_OPENID_REGEX = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';

/**
 * Builds the OpenID callback URL from the deployment's canonical origin (#86).
 *
 * In production this MUST be the deployed HTTPS origin (`NEXTAUTH_URL`), never
 * localhost — Steam redirects the user back to exactly this URL after sign-in.
 * `getEnv()` already fails fast when `NEXTAUTH_URL` is missing/malformed, so the
 * `http://localhost:3000` default here only ever applies to local `pnpm dev`
 * where the var is genuinely unset. Trailing slashes are stripped so the path
 * isn't doubled.
 *
 * @param baseUrl - The canonical origin (e.g. `https://my-app.vercel.app`).
 */
export function authCallbackUrl(baseUrl?: string): string {
  const origin = (baseUrl ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${origin}/api/auth/callback`;
}

/**
 * Extracts the 17-digit SteamID64 from a Steam OpenID claimed_id URL.
 *
 * @param claimedId - The full URL returned by Steam's OpenID endpoint,
 *   e.g. "https://steamcommunity.com/openid/id/76561198000000000"
 * @returns The 17-digit SteamID string, or null if the URL is invalid.
 */
export function extractSteamId(claimedId: string): string | null {
  const match = STEAM_OPENID_REGEX.exec(claimedId);
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Steam OpenID 2.0 assertion verification
// ---------------------------------------------------------------------------
//
// Steam OpenID 2.0 REQUIRES the relying party to re-POST all returned
// openid.* params to https://steamcommunity.com/openid/login with
// openid.mode replaced by "check_authentication" and confirm the response
// body contains "is_valid:true".
//
// Without this step an attacker can craft a callback URL with any claimed_id
// and be authenticated as any SteamID.

/**
 * Verifies a Steam OpenID 2.0 assertion by re-POSTing the callback params to
 * Steam's check_authentication endpoint. Returns the 17-digit SteamID string
 * if verification succeeds, or null if the assertion is invalid/forged.
 *
 * This function is the sole gate between a callback redirect and a session.
 * It is exported so tests can prove that removing it would break authentication.
 *
 * @param params - The openid.* query params from Steam's callback redirect.
 */
export async function verifySteamOpenId(
  params: Record<string, string>,
): Promise<string | null> {
  try {
    // 1. Pre-validate: claimed_id and identity must be Steam URLs before any
    //    network call — rejects obvious forgeries without hitting Steam.
    const claimedId = params['openid.claimed_id'] ?? '';
    const identity = params['openid.identity'] ?? '';
    if (!STEAM_OPENID_REGEX.test(claimedId) || !STEAM_OPENID_REGEX.test(identity)) {
      return null;
    }

    // 2. Re-POST to Steam with openid.mode = check_authentication.
    //    All other params are forwarded as-is; Steam verifies the signature.
    const body = new URLSearchParams({
      ...params,
      'openid.mode': 'check_authentication',
    });

    const response = await fetch(STEAM_OPENID_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) return null;

    const text = await response.text();

    // 3. Steam responds with a key:value body; "is_valid:true" confirms the sig.
    const isValid = text
      .split('\n')
      .some((line) => line.trim() === 'is_valid:true');

    if (!isValid) return null;

    // 4. Extract and return the steamId from the pre-validated claimed_id.
    return extractSteamId(claimedId);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// next-auth configuration factory
// ---------------------------------------------------------------------------
//
// next-auth-steam requires the incoming Request object to build the correct
// openid.return_to and openid.realm values for the authorization redirect.
// Therefore authOptions must be constructed per-request, not as a module-level
// constant. See the App Router usage in app/api/auth/[...nextauth]/route.ts.

/**
 * Builds the next-auth AuthOptions for a given request.
 *
 * The Steam provider (next-auth-steam) handles:
 *   - Redirecting the user to steamcommunity.com/openid/login with correct
 *     openid.return_to and openid.realm params (BLOCKER 2 fix).
 *   - Verifying the returned assertion via check_authentication before the
 *     token callback fires (uses verifySteamOpenId above — BLOCKER 1 fix).
 *
 * clientSecret is the STEAM_API_KEY (used by next-auth-steam for the
 * GetPlayerSummaries call in its userinfo step). NEXTAUTH_SECRET is used
 * only by next-auth itself to sign/encrypt the JWT cookie.
 */
export function buildAuthOptions(req: Request | NextRequest): AuthOptions {
  return {
    // No database adapter — JWT sessions only (ADR §2).
    session: {
      strategy: 'jwt',
    },

    providers: [
      Steam(req as NextRequest, {
        clientSecret: process.env['STEAM_API_KEY'] ?? '',
        callbackUrl: authCallbackUrl(process.env['NEXTAUTH_URL']),
      }),
    ],

    callbacks: {
      /**
       * jwt callback: called whenever a token is created or updated.
       * On sign-in (`user` is present), copy the steamId from user.id.
       * On subsequent requests, the token already carries steamId.
       */
      async jwt({ token, user }: { token: JWT; user?: { id?: string } | null }): Promise<JWT> {
        if (user?.id) {
          token.steamId = user.id;
        }
        return token;
      },

      /**
       * session callback: called whenever a session is checked.
       * Copies steamId from the JWT token onto session.user.
       */
      async session({ session, token }: { session: Session; token: JWT }): Promise<Session> {
        return {
          ...session,
          user: {
            ...session.user,
            steamId: (token.steamId as string) ?? '',
          },
        };
      },
    },

    events: {
      /**
       * Fires after a successful sign-in. Lightweight by design: record
       * `lastLoginAt` and ensure a `User` row exists. The full onboarding
       * backfill (profile + games + baseline snapshot) runs separately via
       * app/onboarding so it never blocks the auth callback. Resilient — any
       * failure here is swallowed so it can never break sign-in.
       */
      async signIn({ user }: { user?: { id?: string } | null }): Promise<void> {
        const steamId = user?.id;
        if (!steamId) return;
        try {
          const now = new Date();
          await prisma.user.upsert({
            where: { steamId },
            update: { lastLoginAt: now },
            create: {
              steamId,
              personaName: '',
              avatarUrl: '',
              createdAt: now,
              lastLoginAt: now,
            },
          });
        } catch {
          // Never break sign-in on a bookkeeping failure.
        }
      },
    },

    secret: process.env['NEXTAUTH_SECRET'],
  };
}

// ---------------------------------------------------------------------------
// authOptions — stable reference for getServerSession() in getSessionUser().
// ---------------------------------------------------------------------------
//
// getServerSession() only needs the callbacks (jwt + session) and session
// strategy — it does not trigger the provider flow. We build a minimal
// options object with a placeholder request so the Steam provider can
// initialise without throwing on a missing URL.

const _placeholderReq = new Request('http://localhost:3000');

/**
 * Stable authOptions reference used by getServerSession() calls in server
 * components and route handlers that only need to READ the current session,
 * not initiate a new sign-in.
 *
 * For the sign-in / callback flow use buildAuthOptions(req) in the route
 * handler so next-auth-steam gets the real request URL.
 */
export const authOptions: AuthOptions = buildAuthOptions(_placeholderReq);

// ---------------------------------------------------------------------------
// getSessionUser — server-side session accessor
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user's steamId from the current session, or null
 * if the request is unauthenticated or the session contains no steamId.
 *
 * Safe to call from RSCs, route handlers, and server actions.
 * Never throws for "no user" — unauthenticated → null.
 */
export async function getSessionUser(): Promise<{ steamId: string } | null> {
  try {
    const session = await getServerSession(authOptions);
    const steamId = session?.user?.steamId;
    if (!steamId) return null;
    return { steamId };
  } catch {
    return null;
  }
}

/**
 * Resolves the steamId whose "my" data a protected view should render: the
 * authenticated session user, else the dev / featured-profile fallback
 * (`env.STEAM_ID`). Middleware guarantees a session on protected routes in
 * production; the fallback keeps local dev and tests working when no session is
 * present. Returns '' only if neither a session nor STEAM_ID exists — callers
 * pass it to repositories which throw MissingSteamIdError on blank input.
 */
export async function getViewerSteamId(): Promise<string> {
  const session = await getSessionUser();
  return session?.steamId ?? getEnv().STEAM_ID ?? '';
}
