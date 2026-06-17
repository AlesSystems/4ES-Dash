import type { FriendStatus } from '@/lib/steam/schemas';

export interface FriendStatusBadgeProps {
  status: FriendStatus;
  /** When non-null the badge shows "In <gameName>" instead of the generic status label. */
  playingName?: string | null;
}

/**
 * Status badge: colored dot + text label.
 * Color is NEVER the only signal — the text label is always present (a11y).
 * When the friend is in a game, shows "In <gameName>" with an accent dot.
 */
export function FriendStatusBadge({ status, playingName }: FriendStatusBadgeProps): JSX.Element {
  if (playingName) {
    return (
      <span className="inline-flex items-center gap-1.5 text-body">
        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
        <span className="truncate text-brand-500 font-medium">In {playingName}</span>
      </span>
    );
  }

  if (status === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 text-body">
        <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
        <span className="text-text-2">Online</span>
      </span>
    );
  }

  if (status === 'away') {
    return (
      <span className="inline-flex items-center gap-1.5 text-body">
        <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden />
        <span className="text-text-2">Away</span>
      </span>
    );
  }

  // offline
  return (
    <span className="inline-flex items-center gap-1.5 text-body">
      <span className="h-2 w-2 shrink-0 rounded-full bg-text-3" aria-hidden />
      <span className="text-text-3">Offline</span>
    </span>
  );
}
