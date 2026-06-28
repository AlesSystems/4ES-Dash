'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Search, Users } from 'lucide-react';
import {
  SORT_KEYS,
  SORT_LABELS,
  STATUS_KEYS,
  STATUS_LABELS,
  type SortKey,
  type StatusFilter,
  type ViewMode,
} from '@/lib/games/sort';
import { cn } from '@/lib/utils';

export interface LibraryControlsProps {
  sort: SortKey;
  query: string;
  total: number;
  shown: number;
  addedUnavailable: boolean;
  status?: StatusFilter;
  view?: ViewMode;
  multiplayer?: boolean;
  uncategorizedCount?: number;
  /** When true the chip labeled "Untouched" is relabeled "Playtime hidden".
   *  The filter still works on real data; the label must not assert "never played". */
  playtimeHidden?: boolean;
}

export function LibraryControls({
  sort,
  query,
  total,
  shown,
  addedUnavailable,
  status = 'all',
  view = 'grid',
  multiplayer = false,
  uncategorizedCount = 0,
  playtimeHidden = false,
}: LibraryControlsProps): JSX.Element {
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
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateUrl('q', value.trim());
    }, 250);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    updateUrl('sort', e.target.value);
  };

  return (
    <div className="flex flex-col gap-3 border-y border-border py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative lg:w-80">
          <label htmlFor="library-search" className="sr-only">
            Search games
          </label>
          <Search
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3"
          />
          <input
            id="library-search"
            type="search"
            placeholder="Search your library"
            value={inputValue}
            onChange={handleSearchChange}
            className="h-10 w-full rounded-md border border-border-2 bg-surface pl-9 pr-12 text-body text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <kbd
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border-2 px-1.5 py-0.5 font-mono text-caption text-text-3 sm:block"
          >
            ⌘K
          </kbd>
        </div>

        {/* Status filter chips */}
        <div
          className="flex flex-wrap items-center gap-2 lg:flex-1"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_KEYS.map((key) => {
            const active = status === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => updateUrl('status', key === 'all' ? '' : key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-caption font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active
                    ? 'bg-brand-500 text-accent-ink'
                    : 'border border-border-2 text-text-2 hover:text-text-1',
                )}
              >
                {key === 'untouched' && playtimeHidden ? 'Playtime hidden' : STATUS_LABELS[key]}
              </button>
            );
          })}
        </div>

        {/* Multiplayer filter toggle */}
        <button
          type="button"
          aria-pressed={multiplayer}
          onClick={() => updateUrl('multiplayer', multiplayer ? '' : '1')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-medium transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            multiplayer
              ? 'bg-brand-500 text-accent-ink'
              : 'border border-border-2 text-text-2 hover:text-text-1',
          )}
        >
          <Users size={14} strokeWidth={1.75} aria-hidden />
          Multiplayer
        </button>

        {/* Sort */}
        <div>
          <label htmlFor="library-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="library-sort"
            value={sort}
            onChange={handleSortChange}
            className="h-10 rounded-md border border-border-2 bg-surface px-3 pr-8 text-body text-text-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div
          className="inline-flex rounded-md border border-border-2 bg-surface p-1"
          role="group"
          aria-label="View mode"
        >
          {(
            [
              { mode: 'grid', label: 'Grid view', Icon: LayoutGrid },
              { mode: 'list', label: 'List view', Icon: List },
            ] as const
          ).map(({ mode, label, Icon }) => {
            const active = view === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() => updateUrl('view', mode === 'grid' ? '' : mode)}
                className={cn(
                  'inline-flex items-center justify-center rounded px-2 py-1 transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active ? 'bg-text-1 text-bg' : 'text-text-3 hover:text-text-1',
                )}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      {/* Count line */}
      <p className="flex flex-wrap items-center gap-2 font-mono text-caption tabular-nums text-text-3">
        <span>
          Showing <span className="font-medium text-text-1">{shown}</span> of {total}
        </span>
        {status !== 'all' && (
          <>
            <span className="text-border-2" aria-hidden>
              ·
            </span>
            <span>
              {status === 'untouched' && playtimeHidden ? 'Playtime hidden' : STATUS_LABELS[status]}
            </span>
          </>
        )}
      </p>

      {/* Date-added availability note */}
      {sort === 'added' && addedUnavailable && (
        <p className="text-caption text-text-3">
          Dates are inferred from snapshots and may be missing for games owned before tracking
          began.
        </p>
      )}

      {/* Multiplayer uncategorized note */}
      {multiplayer && uncategorizedCount > 0 && (
        <p className="text-caption text-text-3">Some games could not be categorized.</p>
      )}
    </div>
  );
}
