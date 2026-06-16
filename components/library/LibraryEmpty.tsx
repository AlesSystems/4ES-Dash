import Link from 'next/link';
import { X, ArrowRight } from 'lucide-react';

export interface LibraryEmptyProps {
  total: number;
  query?: string;
}

export function LibraryEmpty({ total, query }: LibraryEmptyProps): JSX.Element {
  const hasQuery = typeof query === 'string' && query.length > 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border-2 px-8 py-20 flex flex-col items-center justify-center text-center">
      {/* Faint oversized 0 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-serif text-text-1 opacity-5 select-none pointer-events-none tabular-nums"
        style={{ fontSize: 360, lineHeight: 1 }}
        aria-hidden
      >
        0
      </div>

      {/* Foreground stack */}
      <div className="relative z-10 max-w-lg">
        {/* Heading */}
        <p className="font-serif text-display-md text-text-1">
          Nothing <span className="italic text-text-2">matches</span>.
        </p>

        {/* Body */}
        <p className="mt-3 font-serif text-h3 text-text-2 leading-relaxed">
          {hasQuery
            ? `Nothing in your library matches "${query}". Try a different search or clear your filters.`
            : 'No games match these filters. Try loosening them to see more of your shelf.'}
        </p>

        {/* Actions */}
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2.5 text-body font-medium text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Clear all filters
            <X size={14} strokeWidth={1.75} aria-hidden />
          </Link>
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 border-b border-border-2 pb-0.5 text-body font-medium text-text-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Browse all games
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>

        {/* Count line */}
        <p className="mt-6 font-mono text-caption tabular-nums text-text-3">
          Showing 0 of {total.toLocaleString()} games
        </p>
      </div>
    </div>
  );
}
