/**
 * Editorial cover section for the Year in Review page.
 *
 * Monumental serif year glyph (the "Wrapped" design language) with total
 * playtime displayed beneath. The italic last digit is a key editorial flourish
 * per the design spec (docs/design/project/year-in-review.jsx).
 *
 * This is a pure presentational component — no 'use client' needed.
 */

import { formatHours } from '@/lib/format/playtime';

interface ReviewCoverProps {
  year: number;
  totalMinutes: number;
}

export function ReviewCover({ year, totalMinutes }: ReviewCoverProps): JSX.Element {
  // Split the year so we can italicise the last digit per design spec.
  const yearStr = String(year);
  const yearPrefix = yearStr.slice(0, -1);
  const yearLastDigit = yearStr.slice(-1);

  return (
    <section aria-label={`Year in Review cover for ${year}`}>
      {/* Monumental year glyph */}
      <div
        className="flex items-baseline justify-center text-numeral font-serif tabular-nums"
        aria-hidden="true"
      >
        <span className="text-text-1">{yearPrefix}</span>
        <span className="italic text-text-2">{yearLastDigit}</span>
      </div>

      {/* Total hours — the centrepiece stat */}
      <div className="mt-6 text-center">
        <div className="flex items-baseline justify-center gap-3">
          <span className="font-serif text-display-lg tabular-nums text-text-1">
            {formatHours(totalMinutes)}
          </span>
          <span className="font-serif text-h1 italic text-text-2">played</span>
        </div>
        <p className="mt-2 font-mono text-caption uppercase tracking-widest text-text-3">
          Total playtime {year}
        </p>
      </div>
    </section>
  );
}
