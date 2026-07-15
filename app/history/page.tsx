/**
 * Playtime history page — RSC.
 *
 * Reads ?bucket= from the URL (week | month, defaults to week), fetches raw
 * snapshot rows, aggregates them, then renders either a chart (≥ 2 data
 * points) or a designed empty state (< 2 points).
 *
 * The PlaytimeChart client component lazy-loads Tremor internally via
 * next/dynamic, so Tremor is NOT part of the page's initial JS bundle.
 */

import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { getPlaytimeSnapshots } from '@/server/repositories/snapshots';
import { getViewerSteamId } from '@/server/auth';
import { getOnboardingStatus } from '@/server/onboarding-gate';
import {
  aggregatePlaytime,
  historyWindowStart,
  HISTORY_LOOKBACK,
  type Bucket,
} from '@/lib/history/aggregate';
import { HistoryToggle } from '@/components/history/HistoryToggle';
import { PlaytimeChart } from '@/components/history/PlaytimeChart';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Playtime History',
  description: 'View your Steam playtime trends over time, bucketed by week or month.',
};

// Never prerender — data comes from the live DB per request.
export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

interface HistoryPageProps {
  searchParams: { bucket?: string };
}

/** Validates the `?bucket=` param, defaulting to 'week'. */
function parseBucket(raw: string | undefined): Bucket {
  if (raw === 'month') return 'month';
  return 'week';
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const bucket = parseBucket(searchParams.bucket);

  // Gate on onboarding (ERR-0008 pattern): a signed-in user who has never run
  // the backfill has no snapshot rows yet. Showing them "No history yet" is
  // misleading — send them to /onboarding instead. Cheap single-column read;
  // no Steam fan-out on the render path.
  const onboarding = await getOnboardingStatus();
  if (onboarding === 'not-onboarded') {
    redirect('/onboarding');
  }

  const featuredId = await getViewerSteamId();

  // Windowed read (Theme 1 / T4, DATA-6): fetch only the rows the chart can
  // render — HISTORY_LOOKBACK[bucket] back, floored to the bucket boundary so
  // the oldest rendered bucket receives ALL of its rows (a mid-bucket `since`
  // would under-count the first bar).
  const since = historyWindowStart(bucket);
  const rows = await getPlaytimeSnapshots(featuredId, { since });
  const points = aggregatePlaytime(rows, bucket);

  // Pre-window-only data: an empty windowed fetch does NOT mean "no history
  // yet" — an onboarded user's snapshots may all predate the window. Cheap
  // existence probe (indexed count on steamId; the table's compound PK has no
  // scalar id) distinguishes "no data ever" from "no data in window", so the
  // copy never fabricates absence (degrade-never-fabricate).
  const hasPreWindowHistory =
    rows.length === 0 &&
    (await prisma.playtimeSnapshot.count({ where: { steamId: featuredId } })) > 0;

  return (
    <main className={SHELL}>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-text-1">Playtime history</h1>
        <p className="mt-1 text-sm text-text-3">
          Minutes played across your library, bucketed by {bucket}.
        </p>
      </div>

      {rows.length === 0 && hasPreWindowHistory ? (
        /* History exists but all of it predates the fetch window — a quiet
           state, NOT "No history yet" (that would fabricate absence). */
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-text-1">No recent playtime</h2>
          <p className="mt-2 text-sm text-text-3">
            No playtime recorded in the last {HISTORY_LOOKBACK[bucket]}{' '}
            {bucket === 'week' ? 'weeks' : 'months'}. Your older history is intact — nightly
            snapshots will pick things up as soon as you play again.
          </p>
        </div>
      ) : rows.length === 0 ? (
        /* No snapshots at all — first run hasn't fired yet (defensive; the
           onboarding gate normally catches this before render) */
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-text-1">No history yet</h2>
          <p className="mt-2 text-sm text-text-3">
            Snapshots are captured nightly. Come back tomorrow to see your first data point.
          </p>
        </div>
      ) : points.length < 2 ? (
        /* Some snapshots exist but not enough distinct periods to draw a chart */
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-text-1">
            History is still building
          </h2>
          <p className="mt-2 text-sm text-text-3">
            We need at least two {bucket === 'week' ? 'weeks' : 'months'} of data to draw a chart.
            Keep playing and check back soon.
          </p>
        </div>
      ) : (
        /* Chart view */
        <div className="space-y-4">
          <HistoryToggle current={bucket} />
          <PlaytimeChart points={points} bucket={bucket} />
        </div>
      )}
    </main>
  );
}
