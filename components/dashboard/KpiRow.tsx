export interface KpiRowProps {
  totalPlaytimeMinutes: number;
  librarySize: number;
  recentlyPlayedCount: number;
  achievementPercent: number | null;
}

interface KpiCellProps {
  label: string;
  value: string | number;
  unit?: string;
  nullValue?: boolean;
}

function KpiCell({ label, value, unit, nullValue = false }: KpiCellProps): JSX.Element {
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
 * Editorial KPI row for the dashboard.
 * Pure RSC — displays all-time stats with no deltas or period comparisons.
 * Mirrors wrapped.jsx KPI row (lines ~252-276) but without delta indicators.
 */
export function KpiRow({
  totalPlaytimeMinutes,
  librarySize,
  recentlyPlayedCount,
  achievementPercent,
}: KpiRowProps): JSX.Element {
  const hoursPlayed = Math.round(totalPlaytimeMinutes / 60);

  return (
    <div className="mb-8 grid grid-cols-2 divide-x divide-border border-y border-border md:grid-cols-4">
      <KpiCell label="Hours played" value={hoursPlayed} unit="h" />
      <KpiCell label="Games" value={librarySize} />
      <KpiCell label="Played recently" value={recentlyPlayedCount} />
      {achievementPercent !== null ? (
        <KpiCell label="Achievements" value={achievementPercent} unit="%" />
      ) : (
        <KpiCell label="Achievements" value="—" nullValue />
      )}
    </div>
  );
}
