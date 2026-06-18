'use client';

/**
 * Delete account & data — destructive client island. Requires an explicit
 * type-to-confirm step before firing the deleteAccount server action, which
 * removes ALL of the user's rows (snapshots, owned games, manual data,
 * dismissals, and the account) and signs them out.
 */

import { useState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { deleteAccount } from './actions';

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountForm(): JSX.Element {
  const [confirmText, setConfirmText] = useState('');
  const [isPending, startTransition] = useTransition();
  const armed = confirmText.trim() === CONFIRM_WORD;

  function handleDelete() {
    if (!armed) return;
    startTransition(async () => {
      await deleteAccount();
      // Data is gone; clear the JWT cookie and return to the public landing.
      await signOut({ callbackUrl: '/' });
    });
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-5">
      <h3 className="text-h3 font-medium text-text-1">Delete account &amp; data</h3>
      <p className="mt-1 text-body text-text-2">
        Permanently removes your profile, owned-game records, all playtime and achievement
        snapshots, imported data, and dismissals. This cannot be undone.
      </p>
      <label htmlFor="confirm-delete" className="mt-4 block text-caption text-text-3">
        Type <span className="font-mono font-semibold text-text-2">{CONFIRM_WORD}</span> to confirm:
      </label>
      <input
        id="confirm-delete"
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoComplete="off"
        className="mt-1 w-48 rounded-md border border-border bg-bg px-3 py-2 text-body text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      />
      <div className="mt-4">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!armed || isPending}
          className="inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-body font-medium text-bg transition-colors hover:bg-danger/90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          {isPending ? (
            <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden />
          ) : (
            <Trash2 size={16} strokeWidth={1.75} aria-hidden />
          )}
          {isPending ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  );
}
