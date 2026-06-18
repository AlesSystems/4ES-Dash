/**
 * Year in Review page — /review/[year]
 *
 * Editorial "Wrapped" RSC page. Long-scroll, monumental serif year glyph,
 * eyebrow mono labels, top-games list, achievement count. Prev/next year nav
 * uses only years present in getAvailableReviewYears.
 *
 * Design reference: docs/design/project/year-in-review.jsx
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';

import {
  getAvailableReviewYears,
  getYearInReview,
} from '@/server/repositories/insights/year-in-review';
import { EmptyState } from '@/components/states/EmptyState';
import { ReviewCover } from '@/components/review/ReviewCover';
import { TopGamesSection } from '@/components/review/TopGamesSection';

export const metadata: Metadata = {
  title: 'Year in Review',
  description:
    'Your personal Steam Year in Review — top games, total playtime, and achievements unlocked.',
};

export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

interface ReviewPageProps {
  params: { year: string };
}

export default async function YearInReviewPage({ params }: ReviewPageProps) {
  const year = Number(params.year);

  if (!Number.isInteger(year) || year <= 0) {
    notFound();
  }

  const [availableYears, review] = await Promise.all([
    getAvailableReviewYears(),
    getYearInReview(year),
  ]);

  // Year not in available list OR nothing happened that year (no playtime, no
  // top games, AND no achievements — an achievements-only year is NOT empty).
  const isEmpty =
    !availableYears.includes(year) ||
    (review.totalMinutes === 0 &&
      review.topGames.length === 0 &&
      review.achievementsUnlocked === 0);

  // Compute prev/next from the sorted list (descending)
  const sorted = [...availableYears].sort((a, b) => b - a);
  const idx = sorted.indexOf(year);
  // "previous" = older year (higher index), "next" = newer year (lower index)
  const olderYear = idx !== -1 && idx + 1 < sorted.length ? sorted[idx + 1] : null;
  const newerYear = idx !== -1 && idx - 1 >= 0 ? sorted[idx - 1] : null;

  return (
    <main className={SHELL}>
      {/* ── Eyebrow header ── */}
      <div className="mb-10">
        <p className="font-mono text-caption uppercase tracking-[0.32em] text-text-3">
          Year in Review
        </p>
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-border bg-surface p-6">
          <EmptyState
            title={`No data for ${year}`}
            description="Make sure the nightly job has been running to generate Year in Review data."
          />
        </div>
      ) : (
        <div className="space-y-16">
          {/* ── Cover: monumental year glyph ── */}
          <ReviewCover year={review.year} totalMinutes={review.totalMinutes} />

          {/* ── Top games section ── */}
          <TopGamesSection topGames={review.topGames} />

          {/* ── Achievements section (always shown; 0 is a designed state) ── */}
          <section aria-labelledby="achievements-heading">
            <p className="font-mono text-caption uppercase tracking-widest text-text-3">
              Achievements
            </p>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-serif text-display-lg tabular-nums text-text-1">
                {review.achievementsUnlocked.toLocaleString()}
              </span>
              <span className="font-serif text-h1 italic text-text-2">unlocked</span>
            </div>
            <p id="achievements-heading" className="sr-only">
              Achievements unlocked in {year}
            </p>
          </section>
        </div>
      )}

      {/* ── Year navigation ── */}
      {(olderYear !== null || newerYear !== null) && (
        <nav
          className="mt-16 flex items-center justify-between border-t border-border pt-8"
          aria-label="Year navigation"
        >
          {olderYear !== null ? (
            <Link
              href={`/review/${olderYear}`}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-body text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
              {olderYear}
            </Link>
          ) : (
            <span />
          )}

          {newerYear !== null ? (
            <Link
              href={`/review/${newerYear}`}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-body text-text-2 transition-colors hover:bg-surface-2 hover:text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {newerYear}
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
