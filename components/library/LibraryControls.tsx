'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SORT_KEYS, SORT_LABELS, type SortKey } from '@/lib/games/sort';

export interface LibraryControlsProps {
  sort: SortKey;
  query: string;
  total: number;
  shown: number;
  addedUnavailable: boolean;
}

export function LibraryControls({
  sort,
  query,
  total,
  shown,
  addedUnavailable,
}: LibraryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local controlled state for the text input so it's responsive while debouncing.
  const [inputValue, setInputValue] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state if the parent prop changes (e.g., back-button navigation).
  useEffect(() => {
    setInputValue(query);
  }, [query]);

  const updateUrl = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateUrl('q', value.trim());
    }, 250);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateUrl('sort', e.target.value);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search input */}
          <div>
            <label htmlFor="library-search" className="sr-only">
              Search games
            </label>
            <input
              id="library-search"
              type="search"
              placeholder="Search games…"
              value={inputValue}
              onChange={handleSearchChange}
              className={[
                'h-9 w-full rounded-md border border-border bg-surface px-3',
                'text-body text-text-1 placeholder:text-text-3',
                'focus:outline-none focus:ring-2 focus:ring-brand-500',
                'sm:w-56',
              ].join(' ')}
            />
          </div>

          {/* Sort select */}
          <div>
            <label htmlFor="library-sort" className="sr-only">
              Sort by
            </label>
            <select
              id="library-sort"
              value={sort}
              onChange={handleSortChange}
              className={[
                'h-9 rounded-md border border-border bg-surface px-3 pr-8',
                'text-body text-text-1',
                'focus:outline-none focus:ring-2 focus:ring-brand-500',
              ].join(' ')}
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Game count */}
        <p className="text-caption text-text-3 tabular-nums">
          Showing{' '}
          <span className="font-medium text-text-2">
            {shown} of {total}
          </span>
        </p>
      </div>

      {/* Date-added availability note */}
      {sort === 'added' && addedUnavailable && (
        <p className="text-caption text-text-3">
          Dates are inferred from snapshots and may be missing for games owned before tracking
          began.
        </p>
      )}
    </div>
  );
}
