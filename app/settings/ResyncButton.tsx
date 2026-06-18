'use client';

/**
 * Re-sync control — client island. Manually re-runs the onboarding backfill
 * (profile + games + today's snapshot) for the session user. Idempotent and
 * rate-limited server-side (reuses runOnboardingBackfill with force).
 */

import { useState, useTransition } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { resyncNow } from './actions';

export function ResyncButton(): JSX.Element {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleResync() {
    setDone(false);
    startTransition(async () => {
      await resyncNow();
      setDone(true);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleResync}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-body font-medium text-text-1 transition-colors hover:bg-surface-2 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {isPending ? (
          <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden />
        ) : (
          <RefreshCw size={16} strokeWidth={1.75} aria-hidden />
        )}
        {isPending ? 'Re-syncing…' : 'Re-sync now'}
      </button>
      {!isPending && done && (
        <span className="flex items-center gap-1.5 text-caption text-text-3" aria-live="polite">
          <Check size={14} strokeWidth={1.75} className="text-success" aria-hidden /> Synced
        </span>
      )}
    </div>
  );
}
