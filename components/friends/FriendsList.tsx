import type { FriendSummary } from '@/lib/steam/schemas';
import { FriendCard } from './FriendCard';

export interface FriendsListProps {
  friends: FriendSummary[];
}

/**
 * Full friends list — section heading + count + 2-col card grid.
 * The list is pre-sorted by the repository (non-offline first, alpha within groups).
 * Does NOT include activity feed, social stats, or "Compare" actions (descoped, #33).
 */
export function FriendsList({ friends }: FriendsListProps): JSX.Element {
  return (
    <section aria-label="All friends">
      <h2 className="mb-3.5 font-serif text-h2 font-normal tracking-tight text-text-1">
        All <span className="italic text-text-2">friends</span>
        <span className="ml-3 font-mono text-caption font-normal text-text-3">
          {friends.length} shown
        </span>
      </h2>

      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2" role="list" aria-label="Friends list">
        {friends.map((friend) => (
          <li key={friend.steamId}>
            <FriendCard friend={friend} />
          </li>
        ))}
      </ul>
    </section>
  );
}
