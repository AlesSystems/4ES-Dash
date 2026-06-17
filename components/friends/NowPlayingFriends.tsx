import Image from 'next/image';
import type { FriendSummary } from '@/lib/steam/schemas';
import { FriendStatusBadge } from './FriendStatusBadge';

export interface NowPlayingFriendsProps {
  friends: FriendSummary[];
}

/**
 * "Now playing" strip — wider card layout for in-game friends.
 * Renders null when no friends are currently in a game.
 * Does NOT render session duration, hours-together, or activity feed
 * (T4 / descoped per issue #33 — Steam does not expose this data for free).
 */
export function NowPlayingFriends({ friends }: NowPlayingFriendsProps): JSX.Element | null {
  const inGame = friends.filter((f) => f.inGame);

  if (inGame.length === 0) return null;

  return (
    <section aria-label="Friends in-game right now" className="mb-8">
      <h2 className="mb-3.5 font-serif text-h2 font-normal tracking-tight text-text-1">
        Now <span className="italic text-text-2">playing</span>
        <span className="ml-3 font-mono text-caption font-normal text-text-3">
          {inGame.length} in-game
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {inGame.map((friend) => (
          <a
            key={friend.steamId}
            href={friend.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${friend.personaName} — view Steam profile`}
            className="group relative flex items-center gap-3.5 overflow-hidden rounded-lg border border-border-2 bg-surface p-4 transition hover:-translate-y-px hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {/* Avatar */}
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
              <Image
                src={friend.avatar.full}
                alt={friend.personaName}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate font-serif text-h3 font-medium text-text-1">
                {friend.personaName}
              </p>
              <FriendStatusBadge
                status={friend.status}
                playingName={friend.playing?.name ?? null}
              />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
