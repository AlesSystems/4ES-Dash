import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface BacklogCardProps {
  untouchedCount: number;
  librarySize: number;
}

export function BacklogCard({ untouchedCount, librarySize }: BacklogCardProps): JSX.Element {
  const pct = librarySize > 0 ? Math.round((untouchedCount / librarySize) * 100) : 0;
  const isEmpty = untouchedCount === 0;

  return (
    <section className="rounded-lg border border-border bg-surface p-6 relative overflow-hidden">
      {/* Label */}
      <p className="text-caption font-medium uppercase tracking-widest text-text-3">The backlog</p>

      {/* Big number row */}
      <div className="flex items-baseline gap-2 mt-3">
        <span className="font-serif text-numeral tabular-nums text-text-1 leading-none">
          {untouchedCount.toLocaleString()}
        </span>
        {!isEmpty && <span className="font-serif text-stat italic text-text-3">games waiting</span>}
      </div>

      {/* Body sentence */}
      <p className="font-serif text-h3 text-text-2 leading-relaxed mt-3">
        {isEmpty ? (
          "You've started every game you own. Nothing waiting on the shelf."
        ) : (
          <>
            That&apos;s <span className="text-brand-500 font-mono not-italic">{pct}%</span> of your
            library you haven&apos;t started yet.
          </>
        )}
      </p>

      {/* Footer CTA */}
      {!isEmpty && (
        <div className="mt-5 pt-5 border-t border-border">
          <Link
            href="/library?status=untouched"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3.5 py-2 text-body font-medium text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Browse the backlog
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
