/**
 * Genre breakdown page — /insights/genres
 *
 * RSC. Renders genre slices (and optional SteamSpy community tags) as
 * absolute hours + percent of total. A lazy-loaded Tremor chart shows the
 * breakdown visually. Unknown-count note surfaces when >0 games have no metadata.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser, getViewerSteamId } from '@/server/auth';
import { getOnboardingStatus } from '@/server/onboarding-gate';
import { GenreBreakdownSection } from './GenreBreakdownSection';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Genre Breakdown',
  description:
    'Explore how your Steam playtime is distributed across game genres and community tags.',
};

export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

/**
 * Skeleton for the breakdown section — geometry mirrors the chart + table so
 * the streamed content swaps in without layout shift (no CLS).
 */
function GenreBreakdownSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading genre breakdown">
      {/* Chart skeleton */}
      <div className="h-64 w-full animate-pulse rounded-lg bg-surface-2" />
      {/* Table skeleton */}
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
          >
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-12 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function GenresPage() {
  // Gate on onboarding: a signed-in user who has never run the backfill has no
  // ownedGame rows yet. Showing them "No genre data yet" is misleading — send
  // them to /onboarding instead. "No genre data yet" is reserved for an
  // onboarded user with a genuinely empty library. The gate is a cheap single-
  // column read; it never triggers Steam fan-out on the render path (#90).
  //
  // Resolve the session ONCE and pass it to both the gate and the viewer-id
  // resolver, de-duping the getSessionUser waterfall (was called twice).
  const sessionUser = await getSessionUser();
  const onboarding = await getOnboardingStatus(sessionUser);
  if (onboarding === 'not-onboarded') {
    redirect('/onboarding');
  }

  const viewerId = await getViewerSteamId(sessionUser);

  return (
    <main className={SHELL}>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-text-1">Genre breakdown</h1>
        <p className="mt-1 text-sm text-text-3">
          Hours played across your library, grouped by genre.
        </p>
      </div>

      {/* Slow breakdown query streams behind its own Suspense boundary so the
          heading paints immediately (no whole-page block). */}
      <Suspense fallback={<GenreBreakdownSkeleton />}>
        <GenreBreakdownSection viewerId={viewerId} />
      </Suspense>
    </main>
  );
}
