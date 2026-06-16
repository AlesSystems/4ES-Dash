export interface LibraryHeaderProps {
  accountAgeYears: number | null;
  gamesCount: number;
  totalPlaytimeMinutes: number;
  inProgressCount: number;
  untouchedCount: number;
}

export function LibraryHeader({
  accountAgeYears,
  gamesCount,
  totalPlaytimeMinutes,
  inProgressCount,
  untouchedCount,
}: LibraryHeaderProps): JSX.Element {
  const totalHours = Math.round(totalPlaytimeMinutes / 60).toLocaleString();
  const yearLabel = accountAgeYears === 1 ? 'year' : 'years';

  return (
    <div className="mb-6">
      {/* Title block */}
      <h1 className="font-serif font-normal">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-display-lg text-text-1">
            Library<span className="italic text-text-3">,</span>
          </span>
          {accountAgeYears !== null && (
            <span className="text-display-md italic text-text-3">
              {accountAgeYears} {yearLabel} in
            </span>
          )}
        </span>
      </h1>

      {/* Stat line */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-caption tabular-nums text-text-2">
        <span>{gamesCount.toLocaleString()} games</span>
        <span className="text-border-2" aria-hidden>
          ·
        </span>
        <span>{totalHours} hours</span>
        <span className="text-border-2" aria-hidden>
          ·
        </span>
        <span>{untouchedCount.toLocaleString()} unplayed</span>
      </div>

      {/* Stat strip */}
      <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 border-t border-border pt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-caption font-medium uppercase tracking-widest text-text-3">
            In progress
          </span>
          <span className="font-mono text-body tabular-nums text-text-1">
            {inProgressCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-caption font-medium uppercase tracking-widest text-text-3">
            Untouched
          </span>
          <span className="font-mono text-body tabular-nums text-text-1">
            {untouchedCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-caption font-medium uppercase tracking-widest text-text-3">
            Total hours
          </span>
          <span className="font-mono text-body tabular-nums text-text-1">{totalHours}</span>
        </div>
      </div>
    </div>
  );
}
