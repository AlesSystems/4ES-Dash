import type { ReactNode } from 'react';

export interface KpiRowProps {
  totalPlaytimeMinutes: number;
  librarySize: number;
  recentlyPlayedCount: number;
  /** @deprecated — pass an `achievements` ReactNode slot instead. Kept for
   *  backward compat while migrating call sites; ignored when `achievements`
   *  is provided. */
  achievementPercent?: number | null;
  /** Slot for the Achievements 4th cell — supports a Suspense boundary. */
  achievements?: ReactNode;
}

export interface KpiCellProps {
  label: string;
  value: string | number;
  unit?: string;
  nullValue?: boolean;
}

export function KpiCell({ label, value, unit, nullValue = false }: KpiCellProps): JSX.Element {
  return (
    <div className="px-6 py-5">
      <div className="mb-3 text-caption font-medium uppercase tracking-widest text-text-3">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-serif text-numeral tabular-nums leading-none ${
            nullValue ? 'text-text-3' : 'text-text-1'
          }`}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && !nullValue && (
          <span className="font-serif text-stat italic text-text-3">{unit}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Pure presenter for the Achievements KPI cell.
 * Renders the percent value when known, or the designed "—" honest state when null.
 * Own export so homepage tests can stub `AchievementKpiSection` separately (ERR-0006).
 */
export function AchievementKpiCell({ percent }: { percent: number | null }): JSX.Element {
  if (percent !== null) {
    return <KpiCell label="Achievements" value={percent} unit="%" />;
  }
  return <KpiCell label="Achievements" value="—" nullValue />;
}

/**
 * Editorial KPI row for the dashboard.
 * Pure RSC — displays all-time stats with no deltas or period comparisons.
 * Mirrors wrapped.jsx KPI row (lines ~252-276) but without delta indicators.
 *
 * Pass an `achievements` ReactNode slot (a Suspense-wrapped AchievementKpiSection)
 * for the 4th cell. The deprecated `achievementPercent` prop is still accepted for
 * backward compat but ignored when `achievements` is provided.
 */
export function KpiRow({
  totalPlaytimeMinutes,
  librarySize,
  recentlyPlayedCount,
  achievementPercent,
  achievements,
}: KpiRowProps): JSX.Element {
  const hoursPlayed = Math.round(totalPlaytimeMinutes / 60);

  const achievementsCell =
    achievements !== undefined ? (
      achievements
    ) : (
      <AchievementKpiCell percent={achievementPercent ?? null} />
    );

  return (
    <div className="mb-8 grid grid-cols-2 divide-x divide-border border-y border-border md:grid-cols-4">
      <KpiCell label="Hours played" value={hoursPlayed} unit="h" />
      <KpiCell label="Games" value={librarySize} />
      <KpiCell label="Played recently" value={recentlyPlayedCount} />
      {achievementsCell}
    </div>
  );
}
