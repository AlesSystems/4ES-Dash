'use client';

import { ChevronDown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PAGE_SIZE, parseLimitParam } from '@/lib/games/sort';

export interface LoadMoreButtonProps {
  /** Games not yet shown — caps the button label ("Load N more"). */
  remaining: number;
}

/**
 * Client leaf for library pagination. Paging is URL state: a click bumps
 * `?limit=` by one page via `router.replace` (preserving every other param,
 * `{ scroll: false }` so the viewport stays put) and the RSC re-renders with
 * the larger slice. The current limit is derived with `parseLimitParam` — a
 * fresh `/library` visit has NO `limit` param (the default 24 lives
 * server-side only), so raw `searchParams.get('limit')` arithmetic would be
 * null-broken on the first click.
 */
export function LoadMoreButton({ remaining }: LoadMoreButtonProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = (): void => {
    const current = parseLimitParam(searchParams.get('limit'));
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', String(current + PAGE_SIZE));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-full border border-border-2 bg-surface px-5 py-2.5 text-body font-medium text-text-1 transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      Load {Math.min(PAGE_SIZE, remaining)} more
      <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
