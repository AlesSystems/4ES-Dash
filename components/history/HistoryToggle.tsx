'use client';

/**
 * Segmented control for switching between 'week' and 'month' bucket views.
 * Updates the `?bucket=` URL search param via router.replace — no client store.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Bucket } from '@/lib/history/aggregate';

interface HistoryToggleProps {
  /** Currently active bucket, read from the page's searchParams. */
  current: Bucket;
}

const OPTIONS: { label: string; value: Bucket }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

export function HistoryToggle({ current }: HistoryToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(bucket: Bucket) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('bucket', bucket);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex rounded-lg border border-border bg-surface p-1 gap-1"
    >
      {OPTIONS.map(({ label, value }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => handleSelect(value)}
            className={[
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-500 text-accent-ink' : 'text-text-2 hover:bg-surface-2',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
