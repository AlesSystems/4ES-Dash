'use client';

/**
 * Sign-out control — client island. Ends the next-auth session and returns to
 * the public landing. Used on the settings page (the app-bar UserMenu has its
 * own sign-out item).
 */

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export function SignOutButton(): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-body font-medium text-text-1 transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <LogOut size={16} strokeWidth={1.75} aria-hidden />
      Sign out
    </button>
  );
}
