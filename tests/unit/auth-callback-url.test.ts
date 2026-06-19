import { describe, it, expect } from 'vitest';
import { authCallbackUrl } from '@/server/auth';

/**
 * The Steam OpenID callback URL must derive from the deployment's canonical
 * origin (`NEXTAUTH_URL`) (#86) — never a hard-coded localhost when a real URL
 * is configured. `getEnv()` separately fails fast when NEXTAUTH_URL is missing
 * (env schema: z.string().url()).
 */

describe('authCallbackUrl', () => {
  it('derives the callback from the deployed HTTPS origin (no localhost)', () => {
    const url = authCallbackUrl('https://my-app.vercel.app');
    expect(url).toBe('https://my-app.vercel.app/api/auth/callback');
    expect(url).not.toContain('localhost');
  });

  it('strips a trailing slash so the path is not doubled', () => {
    expect(authCallbackUrl('https://my-app.vercel.app/')).toBe(
      'https://my-app.vercel.app/api/auth/callback',
    );
  });

  it('falls back to localhost only when no origin is provided (local dev)', () => {
    expect(authCallbackUrl(undefined)).toBe('http://localhost:3000/api/auth/callback');
  });
});
