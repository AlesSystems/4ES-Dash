/**
 * components/library/PlaytimeHiddenBanner.tsx
 *
 * In-context banner shown when a library's playtime is hidden by Steam's
 * "Game details" privacy setting (bug-02). Renders an honest explanation
 * with a direct link to the Steam privacy settings page.
 *
 * Never fabricates a number — no count, no hours, no zero.
 * Mirrors StaleBanner tokens (border-border, bg-surface-2, text-text-2).
 */

export function PlaytimeHiddenBanner(): JSX.Element {
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-caption text-text-2"
    >
      Playtime is hidden by this account&apos;s Steam Game-details privacy.{' '}
      <a
        href="https://steamcommunity.com/my/edit/settings"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-text-1"
      >
        Update privacy settings
      </a>
    </div>
  );
}
