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

import { getPlaytimeSnapshots } from '@/server/repositories/snapshots';
import { getViewerSteamId } from '@/server/auth';
import { aggregatePlaytime, type Bucket } from '@/lib/history/aggregate';
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

  const featuredId = await getViewerSteamId();
  const rows = await getPlaytimeSnapshots(featuredId);
  const points = aggregatePlaytime(rows, bucket);

  return (
    <main className={SHELL}>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-text-1">Playtime history</h1>
        <p className="mt-1 text-sm text-text-3">
          Minutes played across your library, bucketed by {bucket}.
        </p>
      </div>

      {points.length < 2 ? (
        /* ≥2-points guard — designed empty state, not a blank chart */
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold text-text-1">
            Not enough history yet — check back tomorrow
          </h2>
          <p className="mt-2 text-sm text-text-3">
            We need at least two days of snapshot data to draw a chart. Keep playing and come back
            soon.
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
