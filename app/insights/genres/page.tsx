/**
 * Genre breakdown page — /insights/genres
 *
 * RSC. Renders genre slices (and optional SteamSpy community tags) as
 * absolute hours + percent of total. A lazy-loaded Tremor chart shows the
 * breakdown visually. Unknown-count note surfaces when >0 games have no metadata.
 */

import { getGenreBreakdown } from '@/server/repositories/insights/genres';
import { getViewerSteamId } from '@/server/auth';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { GenreChart } from '@/components/insights/GenreChart';
import { formatHours } from '@/lib/format/playtime';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Genre Breakdown',
  description:
    'Explore how your Steam playtime is distributed across game genres and community tags.',
};

export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default async function GenresPage() {
  const viewerId = await getViewerSteamId();
  const { genres, tags, stale, unknownFromUnavailable } = await getGenreBreakdown(viewerId);

  const hasGenres = genres.slices.length > 0;
  const hasTags = tags !== null && tags.slices.length > 0;

  return (
    <main className={SHELL}>
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-semibold text-text-1">Genre breakdown</h1>
        <p className="mt-1 text-sm text-text-3">
          Hours played across your library, grouped by genre.
        </p>
      </div>

      {stale && <StaleBanner className="mb-4" />}

      {!hasGenres ? (
        <EmptyState
          title="No genre data yet"
          description="Play some games or make sure the nightly job has run to see your genre breakdown."
        />
      ) : (
        <div className="space-y-10">
          {/* Genre chart */}
          <section aria-labelledby="genres-heading">
            <h2 id="genres-heading" className="mb-4 text-h2 font-semibold text-text-1">
              Genres
            </h2>

            <GenreChart
              slices={genres.slices}
              totalMinutes={genres.totalMinutes}
              aria-label="Genre breakdown chart"
            />

            {/* Slice table */}
            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="px-4 py-2.5 text-left text-caption font-medium uppercase tracking-widest text-text-3">
                      Genre
                    </th>
                    <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                      Hours
                    </th>
                    <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                      % of total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {genres.slices.map((slice) => (
                    <tr key={slice.label} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text-1">{slice.label}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-2">
                        {formatHours(slice.minutes)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-text-3">
                        {slice.percent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Unknown count note */}
            {unknownFromUnavailable > 0 && (
              <p className="mt-3 text-caption text-text-3">
                {unknownFromUnavailable} {unknownFromUnavailable === 1 ? 'game' : 'games'} folded
                into &ldquo;Unknown&rdquo; because store metadata was unavailable.
              </p>
            )}
          </section>

          {/* Community tags section (SteamSpy, optional) */}
          {hasTags && tags !== null && (
            <section aria-labelledby="tags-heading">
              <h2 id="tags-heading" className="mb-1 text-h2 font-semibold text-text-1">
                Community tags
              </h2>
              <p className="mb-4 text-sm text-text-3">
                Data from SteamSpy — reflects community-assigned tags.
              </p>

              <div className="overflow-hidden rounded-lg border border-border bg-surface">
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      <th className="px-4 py-2.5 text-left text-caption font-medium uppercase tracking-widest text-text-3">
                        Tag
                      </th>
                      <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                        Hours
                      </th>
                      <th className="px-4 py-2.5 text-right text-caption font-medium uppercase tracking-widest text-text-3">
                        % of total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tags.slices.map((slice) => (
                      <tr key={slice.label} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text-1">{slice.label}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-text-2">
                          {formatHours(slice.minutes)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-text-3">
                          {slice.percent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
