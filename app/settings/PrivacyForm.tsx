'use client';

/**
 * Privacy control — client island. Sets who can see the user's dashboard.
 * Bound to the session user via the setPrivacy server action (never another
 * user). Optimistic pending state; the server action revalidates the page.
 */

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { setPrivacy } from './actions';

type Privacy = 'public' | 'friendsOnly' | 'private';

const OPTIONS: { value: Privacy; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone can view your dashboard at /u/<your id>.' },
  {
    value: 'friendsOnly',
    label: 'Friends only',
    hint: 'Only your Steam friends can view it. If your friends list is private, it falls back to private.',
  },
  { value: 'private', label: 'Private', hint: 'Only you can view it.' },
];

export function PrivacyForm({ current }: { current: Privacy }): JSX.Element {
  const [value, setValue] = useState<Privacy>(current);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: Privacy) {
    setValue(next);
    setSaved(false);
    startTransition(async () => {
      await setPrivacy(next);
      setSaved(true);
    });
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-h3 font-medium text-text-1">Profile visibility</legend>
      <p className="text-body text-text-2">Who can see your dashboard.</p>
      <div className="mt-2 space-y-2">
        {OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className="rounded-lg border border-border bg-surface has-[:checked]:border-brand-500"
          >
            <label
              htmlFor={`privacy-${opt.value}`}
              className="flex cursor-pointer items-center gap-3 px-4 pt-4"
            >
              <input
                id={`privacy-${opt.value}`}
                type="radio"
                name="privacy"
                value={opt.value}
                checked={value === opt.value}
                onChange={() => handleChange(opt.value)}
                disabled={isPending}
                aria-describedby={`privacy-${opt.value}-hint`}
                className="accent-brand-500"
              />
              <span className="text-body font-medium text-text-1">{opt.label}</span>
            </label>
            <p
              id={`privacy-${opt.value}-hint`}
              className="px-4 pb-4 pl-10 text-caption text-text-3"
            >
              {opt.hint}
            </p>
          </div>
        ))}
      </div>
      <p className="flex h-5 items-center gap-1.5 text-caption text-text-3" aria-live="polite">
        {isPending && (
          <>
            <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden /> Saving…
          </>
        )}
        {!isPending && saved && (
          <>
            <Check size={14} strokeWidth={1.75} className="text-success" aria-hidden /> Saved
          </>
        )}
      </p>
    </fieldset>
  );
}
