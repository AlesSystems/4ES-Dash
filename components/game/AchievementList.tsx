/**
 * AchievementList — renders a game's achievement list or a designed empty state.
 *
 * Props:
 *   result  Availability<GameAchievements> returned from getGameAchievements()
 *
 * Degraded states:
 *   - 'private'        → "Achievements hidden (private profile)"
 *   - 'no-achievements' → "This game has no achievements"
 *   - anything else   → generic UnavailableState
 *
 * RSC: pure render, no 'use client'.
 *
 * Achievement icon hosts (all on the Steam allow-list in next.config.mjs):
 *   - media.steampowered.com
 * If an icon URL is empty, we skip rendering the image.
 */

import Image from 'next/image';
import type { Availability } from '@/lib/result';
import type { GameAchievements, MergedAchievement } from '@/lib/achievements/aggregate';
import { UnavailableState } from '@/components/states/UnavailableState';

export interface AchievementListProps {
  result: Availability<GameAchievements>;
}

// ---------------------------------------------------------------------------
// Individual achievement row
// ---------------------------------------------------------------------------

function AchievementRow({ item }: { item: MergedAchievement }): JSX.Element {
  return (
    <li className="flex items-start gap-4 py-3">
      {/* Icon */}
      {item.iconUrl.length > 0 ? (
        <div className="flex-shrink-0">
          <Image
            src={item.iconUrl}
            alt={item.displayName}
            width={48}
            height={48}
            className="rounded-sm"
            unoptimized
          />
        </div>
      ) : (
        <div
          className="flex-shrink-0 h-12 w-12 rounded-sm bg-surface-2 border border-border"
          aria-hidden
        />
      )}

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-body font-medium text-text-1">{item.displayName}</p>
          {item.unlocked ? (
            <span className="text-caption text-success font-medium">Unlocked</span>
          ) : (
            <span className="text-caption text-text-3">Locked</span>
          )}
        </div>

        {item.description.length > 0 && (
          <p className="mt-0.5 text-caption text-text-2 line-clamp-2">{item.description}</p>
        )}

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-text-3">
          {item.unlocked && item.unlockedAt !== null && (
            <span>
              Unlocked{' '}
              <time dateTime={item.unlockedAt} className="tabular-nums">
                {new Date(item.unlockedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </time>
            </span>
          )}
          {item.globalPercent !== null && (
            <span className="tabular-nums">{item.globalPercent.toFixed(1)}% of players</span>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ percent }: { percent: number }): JSX.Element {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Achievement progress: ${clamped}%`}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AchievementList({ result }: AchievementListProps): JSX.Element {
  if (!result.available) {
    // Acceptance: private → specific wording; no-achievements → specific wording
    if (result.reason === 'private') {
      return (
        <UnavailableState
          reason="private"
          title="Achievements hidden (private profile)"
          description="Set your Steam profile to public to see achievement data."
        />
      );
    }
    if (result.reason === 'no-achievements') {
      return (
        <UnavailableState
          reason="no-achievements"
          title="This game has no achievements"
          description="The developer hasn't added achievement support for this game."
        />
      );
    }
    return <UnavailableState reason={result.reason} />;
  }

  const { unlocked, total, percent, items } = result.data;

  return (
    <section aria-labelledby="achievements-heading">
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h2 id="achievements-heading" className="text-h2 font-semibold text-text-1">
          Achievements
        </h2>
        <span className="text-body text-text-2 tabular-nums">
          {unlocked} of {total} unlocked
        </span>
      </div>

      <ProgressBar percent={percent} />

      {items.length === 0 ? null : (
        <ul className="mt-4 divide-y divide-border" aria-label="Achievement list">
          {items.map((item) => (
            <AchievementRow key={item.apiName} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
