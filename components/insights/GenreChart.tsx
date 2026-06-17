'use client';

/**
 * Genre breakdown chart — lazy-loaded Tremor DonutChart.
 *
 * Tremor is lazy-loaded via next/dynamic (ssr: false) so it stays out of the
 * page's initial JS bundle. A height-matched skeleton prevents CLS.
 *
 * Mirrors the PlaytimeChart pattern from components/history/PlaytimeChart.tsx.
 */

import dynamic from 'next/dynamic';
import type { BreakdownSlice } from '@/lib/insights/genres';

// ---------------------------------------------------------------------------
// Lazy-load Tremor DonutChart — excluded from initial bundle.
// The loading skeleton matches the chart height (h-64 = 256 px).
// ---------------------------------------------------------------------------

const LazyDonutChart = dynamic(() => import('@tremor/react').then((m) => m.DonutChart), {
  ssr: false,
  loading: () => <ChartLoadingSkeleton />,
});

// ---------------------------------------------------------------------------
// Skeleton shown while Tremor chunk is loading.
// ---------------------------------------------------------------------------

function ChartLoadingSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-lg bg-surface-2" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GenreChartProps {
  slices: BreakdownSlice[];
  totalMinutes: number;
  'aria-label'?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenreChart({
  slices,
  totalMinutes: _totalMinutes,
  'aria-label': ariaLabel = 'Genre breakdown',
}: GenreChartProps): JSX.Element {
  // Tremor expects {name, value} records
  const data = slices.map((s) => ({ name: s.label, value: s.minutes }));

  const valueFormatter = (minutes: number): string => {
    const hours = minutes / 60;
    if (Number.isInteger(hours)) return `${hours} h`;
    return `${hours.toFixed(1)} h`;
  };

  return (
    <div
      className="rounded-lg border border-border bg-surface p-5"
      role="img"
      aria-label={ariaLabel}
    >
      <LazyDonutChart
        data={data}
        category="value"
        index="name"
        colors={['amber', 'orange', 'rose', 'emerald', 'sky', 'violet', 'stone', 'slate']}
        valueFormatter={valueFormatter}
        className="h-64"
        showLabel={false}
      />
    </div>
  );
}
