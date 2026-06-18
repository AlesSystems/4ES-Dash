'use client';

import { LogIn } from 'lucide-react';
import { signIn } from 'next-auth/react';

/**
 * SignInButton — "Sign in with Steam" entry point.
 *
 * A "use client" component; onClick triggers the next-auth Steam OpenID flow.
 * Tailwind tokens only (no hardcoded hex). lucide-react icon, stroke 1.75.
 * Real <button> element for full keyboard/screen-reader accessibility.
 */
export function SignInButton(): JSX.Element {
  return (
    <button
      type="button"
      aria-label="Sign in with Steam"
      onClick={() => void signIn('steam')}
      className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-body font-semibold text-accent-ink transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <LogIn strokeWidth={1.75} className="h-4 w-4 shrink-0" aria-hidden />
      Sign in with Steam
    </button>
  );
}
