import Image from 'next/image';
import type { FriendSummary } from '@/lib/steam/schemas';
import { FriendStatusBadge } from './FriendStatusBadge';

export interface FriendCardProps {
  friend: FriendSummary;
}

/**
 * Friend tile — avatar, persona name, status badge, current game.
 * Links to the friend's public Steam profile page (external).
 * Renders ONLY data available from the Steam API:
 *   avatar · persona name · status (dot + label) · current game · friendSince (year).
 * No activity feed, no social stats, no hours-together — those are T4/descoped.
 */
export function FriendCard({ friend }: FriendCardProps): JSX.Element {
  const { personaName, avatar, profileUrl, status, playing, friendSince } = friend;

  const friendSinceYear = friendSince ? new Date(friendSince).getFullYear() : null;

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${personaName} — view Steam profile`}
      className="group flex items-center gap-3.5 rounded-lg border border-border bg-surface p-4 transition hover:-translate-y-px hover:border-border-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {/* Avatar */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
        <Image src={avatar.full} alt={personaName} fill sizes="56px" className="object-cover" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="mb-1 truncate font-serif text-h3 font-medium text-text-1">{personaName}</p>
        <FriendStatusBadge status={status} playingName={playing?.name ?? null} />
        {friendSinceYear !== null && (
          <p className="mt-1 text-caption text-text-3">Friends since {friendSinceYear}</p>
        )}
      </div>
    </a>
  );
}
