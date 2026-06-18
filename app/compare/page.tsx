import { isValidSteamId } from '@/lib/compare';
import { getComparison } from '@/server/repositories/compare';
import { getSessionUser } from '@/server/auth';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBanner } from '@/components/states/StaleBanner';
import { CompareHeader } from '@/components/compare/CompareHeader';
import { SharedGamesTable } from '@/components/compare/SharedGamesTable';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Libraries',
  description:
    'Compare two Steam libraries side-by-side to find shared games and playtime differences.',
};

// Reads live Steam data per request — never prerender at build time.
export const dynamic = 'force-dynamic';

const SHELL = 'px-4 py-8 sm:px-6 lg:px-10';

interface ComparePageProps {
  searchParams: { a?: string; b?: string };
}

/** Friendly display name for a side when the profile failed to load. */
function friendlyName(steamId: string): string {
  return `Player ${steamId.slice(-4)}`;
}

export default async function ComparePage({
  searchParams,
}: ComparePageProps): Promise<JSX.Element> {
  // Side A resolves from the session user — NEVER from env.STEAM_ID (placeholder).
  // getSessionUser() returns null for anonymous visitors; we degrade to EmptyState
  // rather than fetching a placeholder account.
  const sessionUser = await getSessionUser();
  const sessionSteamId = sessionUser?.steamId ?? null;

  // Trim here so the validated value and the value passed downstream (cache key +
  // Steam request) are identical — isValidSteamId trims internally too.
  const aId = (searchParams.a ?? sessionSteamId ?? '').trim();
  const bId = searchParams.b?.trim();

  // Validate IDs — show an input prompt instead of crashing.
  if (!isValidSteamId(aId) || !isValidSteamId(bId)) {
    return (
      <main className={SHELL}>
        <h1 className="mb-6 font-serif text-h1 font-normal text-text-1">Compare libraries</h1>
        <EmptyState
          title="Compare two Steam libraries"
          description={
            !isValidSteamId(bId)
              ? 'Add ?b=<17-digit SteamID> to compare with another player.'
              : 'The SteamID in ?a= is not a valid 17-digit SteamID.'
          }
        />
      </main>
    );
  }

  const cmp = await getComparison(aId, bId);

  // Friendly fallback: never render a raw 17-digit steamId as a display name.
  const aName = cmp.a.profile?.personaName ?? friendlyName(cmp.a.steamId);
  const bName = cmp.b.profile?.personaName ?? friendlyName(cmp.b.steamId);

  return (
    <main className={SHELL}>
      <h1 className="sr-only">
        Compare {aName} vs {bName}
      </h1>

      {/* Two-user side-by-side header */}
      <CompareHeader a={cmp.a} b={cmp.b} />

      {/* Stale data banner */}
      {cmp.stale ? <StaleBanner className="mb-6" /> : null}

      {/* Same-user guard */}
      {cmp.sameUser ? (
        <EmptyState title="Same profile" description="Pick two different players to compare." />
      ) : cmp.shared === null ? (
        /* Shared games skipped — identify why (private side vs. a load failure) */
        <div
          role="status"
          className="mt-4 rounded-lg border border-border bg-surface p-6 text-body text-text-2"
        >
          {cmp.a.isPrivate && cmp.b.isPrivate
            ? "Shared games can't be computed because both libraries are private."
            : cmp.a.isPrivate
              ? `Shared games can't be computed because ${aName}'s library is private.`
              : cmp.b.isPrivate
                ? `Shared games can't be computed because ${bName}'s library is private.`
                : "Shared games can't be computed — one of the libraries couldn't be loaded. Try again shortly."}
        </div>
      ) : cmp.shared.length === 0 ? (
        <EmptyState
          title="No games in common"
          description={`${aName} and ${bName} don't share any games.`}
        />
      ) : (
        <SharedGamesTable rows={cmp.shared} aName={aName} bName={bName} />
      )}
    </main>
  );
}
