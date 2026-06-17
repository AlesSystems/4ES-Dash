'use client';

/**
 * Dismiss button for an idle-spike flag.
 *
 * Client island — uses useTransition to call dismissIdleFlagAction without
 * blocking the UI. Shows a spinner during the transition and a "Dismissed"
 * state on success (optimistic UI; the page re-renders on next visit).
 */

import { useTransition, useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { dismissIdleFlagAction } from '@/app/insights/idle/actions';

interface DismissFlagButtonProps {
  appId: number;
  fromDate: string; // ISO string
  toDate: string; // ISO string
}

export function DismissFlagButton({
  appId,
  fromDate,
  toDate,
}: DismissFlagButtonProps): JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  function handleDismiss() {
    startTransition(async () => {
      await dismissIdleFlagAction({ appId, fromDate, toDate });
      setDismissed(true);
    });
  }

  if (dismissed) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-text-3">
        <Check size={14} strokeWidth={1.75} aria-hidden />
        Dismissed
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDismiss}
      disabled={isPending}
      aria-label="Dismiss this idle flag"
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-2 transition-colors hover:border-border-2 hover:bg-surface-2 hover:text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden />
      ) : (
        <X size={14} strokeWidth={1.75} aria-hidden />
      )}
      {isPending ? 'Dismissing…' : 'Dismiss'}
    </button>
  );
}
