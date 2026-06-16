'use client';

/**
 * Tremor BarChart wrapper for the playtime history page.
 *
 * Tremor is lazy-loaded via next/dynamic (ssr: false) so it stays out of the
 * page's initial JS bundle — only downloaded when this client component mounts.
 * A height-matched skeleton is shown while the chunk loads to prevent CLS.
 */

import dynamic from 'next/dynamic';
import type { PlaytimePoint, Bucket } from '@/lib/history/aggregate';

// ---------------------------------------------------------------------------
// Lazy-load Tremor's BarChart — excluded from initial bundle.
// The loading skeleton matches the chart height (h-72 = 288 px).
// ---------------------------------------------------------------------------

const LazyBarChart = dynamic(() => import('@tremor/react').then((m) => m.BarChart), {
  ssr: false,
  loading: () => <ChartLoadingSkeleton />,
});

// ---------------------------------------------------------------------------
// Value formatter: converts raw minutes into a compact label.
// < 60 min → "Xm"  |  ≥ 60 min → "Xh" (rounded to 1 decimal if < 10 h)
// ---------------------------------------------------------------------------

function formatHoursLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 10) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours)}h`;
}

// ---------------------------------------------------------------------------
// Skeleton shown while Tremor chunk is loading.
// ---------------------------------------------------------------------------

function ChartLoadingSkeleton() {
  return <div className="h-72 w-full animate-pulse rounded-lg bg-surface-2" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlaytimeChartProps {
  points: PlaytimePoint[];
  bucket: Bucket;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaytimeChart({ points, bucket }: PlaytimeChartProps) {
  const unitLabel = bucket === 'week' ? 'week' : 'month';
  return (
    <div
      className="rounded-lg border border-border bg-surface p-5"
      role="img"
      aria-label={`Playtime in minutes per ${unitLabel}`}
    >
      <p className="text-caption text-text-3 mb-3">Minutes played per {unitLabel}</p>
      <LazyBarChart
        data={points}
        index="period"
        categories={['minutes']}
        colors={['amber']}
        valueFormatter={formatHoursLabel}
        showLegend={false}
        className="h-72"
        yAxisWidth={48}
      />
    </div>
  );
}
