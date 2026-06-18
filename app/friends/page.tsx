import { isSteamApiError } from '@/lib/steam/errors';
import { getFriends } from '@/server/repositories/friends';
import { getViewerSteamId } from '@/server/auth';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { NowPlayingFriends } from '@/components/friends/NowPlayingFriends';
import { FriendsList } from '@/components/friends/FriendsList';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Friends',
  description: 'See which Steam friends are online, away, or in-game right now.',
};

// Reads live Steam data per request — never prerender at build time.
export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

export default async function FriendsPage(): Promise<JSX.Element> {
  let friends;
  let stale = false;

  try {
    const featuredId = await getViewerSteamId();
    const data = await getFriends(featuredId);
    friends = data.friends;
    stale = data.stale;
  } catch (error) {
    if (isSteamApiError(error) && error.kind === 'private') {
      return (
        <main className={SHELL}>
          <h1 className="sr-only">Friends</h1>
          <EmptyState
            title="Friend list is private"
            description="Make your Steam friends list public to see your friends here. Steam → Settings → Privacy → Friends list = Public."
          />
        </main>
      );
    }
    throw error;
  }

  if (friends.length === 0) {
    return (
      <main className={SHELL}>
        <h1 className="sr-only">Friends</h1>
        <EmptyState
          title="No friends to show"
          description="Your Steam friends list is empty, or your privacy settings hide it from the public profile we read."
        />
      </main>
    );
  }

  // Count strictly-online separately from away — the per-card badges distinguish
  // the two, so the summary must not lump "away" friends under "online".
  const onlineCount = friends.filter((f) => f.status === 'online').length;
  const awayCount = friends.filter((f) => f.status === 'away').length;
  const inGameCount = friends.filter((f) => f.inGame).length;

  return (
    <main className={SHELL}>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-serif text-display-md font-normal tracking-tight text-text-1">
          Friends
          <span aria-hidden="true" className="ml-3 font-serif italic text-text-3">
            ,
          </span>
        </h1>
        <p className="mt-2 font-mono text-caption tabular-nums text-text-3">
          {friends.length} friends
          <span aria-hidden="true" className="mx-2 text-border-2">
            ·
          </span>
          {onlineCount} online
          {awayCount > 0 && (
            <>
              <span aria-hidden="true" className="mx-2 text-border-2">
                ·
              </span>
              {awayCount} away
            </>
          )}
          {inGameCount > 0 && (
            <>
              <span aria-hidden="true" className="mx-2 text-border-2">
                ·
              </span>
              {inGameCount} in-game
            </>
          )}
        </p>
      </div>

      {stale ? <StaleBanner className="mb-4" /> : null}

      <NowPlayingFriends friends={friends} />

      <FriendsList friends={friends} />
    </main>
  );
}
