import Image from 'next/image';
import type { Availability } from '@/lib/result';
import type { LibrarySummary } from '@/server/repositories/achievements';
import { EmptyState } from '@/components/states/EmptyState';

export interface AchievementSummaryProps {
  result: Availability<LibrarySummary>;
}

/**
 * Achievement progress summary (#18).
 *
 * Pure RSC — receives pre-fetched Availability<LibrarySummary> from the page.
 * Shows total completion percentage + recent unlocks (last 7 days).
 */
export function AchievementSummary({ result }: AchievementSummaryProps): JSX.Element {
  if (!result.available) {
    return (
      <section aria-label="Achievement progress">
        <h2 className="mb-4 text-h2 font-semibold text-text-1">Achievements</h2>
        <EmptyState
          title="No achievement data yet"
          description="Play games with achievements to see your progress."
        />
      </section>
    );
  }

  const { totalUnlocked, totalAvailable, percent, recentUnlocks } = result.data;

  return (
    <section aria-label="Achievement progress">
      <h2 className="mb-4 text-h2 font-semibold text-text-1">Achievements</h2>

      {/* Overall completion */}
      <div className="mb-6 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <div className="mb-2 flex items-baseline gap-2">
          <span
            className="text-display font-bold tabular-nums text-text-1"
            aria-label={`${percent}% achievement completion`}
          >
            {percent}%
          </span>
          <span className="text-body text-text-2">Achievement completion</span>
        </div>

        {/* Slim progress bar */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of achievements unlocked`}
        >
          <div
            className="h-full rounded-full bg-success transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="mt-2 text-caption text-text-3 tabular-nums">
          {totalUnlocked.toLocaleString()} / {totalAvailable.toLocaleString()} unlocked
        </p>
      </div>

      {/* Recent unlocks */}
      <div>
        <h3 className="mb-3 text-h3 font-semibold text-text-1">Recent unlocks</h3>

        {recentUnlocks.length === 0 ? (
          <p className="text-body text-text-3">No unlocks in the last 7 days</p>
        ) : (
          <ul className="flex flex-col gap-3" role="list">
            {recentUnlocks.map((achievement) => (
              <li
                key={achievement.apiName}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                {/* Achievement icon */}
                {achievement.iconUrl !== '' ? (
                  <Image
                    src={achievement.iconUrl}
                    alt=""
                    width={32}
                    height={32}
                    sizes="32px"
                    // Steam serves achievement icons from several CDN hosts that
                    // aren't all in the next/image allow-list; unoptimized renders
                    // the URL directly (no server fetch) so an unlisted host can't
                    // crash the page. Icons are tiny — optimization gain is moot.
                    unoptimized
                    className="shrink-0 rounded-sm"
                    aria-hidden
                  />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-sm bg-surface-2" aria-hidden />
                )}

                {/* Name + date */}
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium text-text-1 truncate">
                    {achievement.displayName}
                  </p>
                  {achievement.unlockedAt !== null && (
                    <p className="text-caption text-text-3 tabular-nums">
                      <time dateTime={achievement.unlockedAt}>
                        {new Date(achievement.unlockedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </time>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
