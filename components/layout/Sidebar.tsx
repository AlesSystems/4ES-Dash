import { getProfile } from '@/server/repositories/profile';
import { SidebarNav } from './SidebarNav';

/**
 * Persistent left sidebar (desktop only) for the warm "Wrapped" shell.
 *
 * Async RSC: self-fetches the profile (cached, shared with the page + header)
 * to surface the real library size and untouched count. Degrades silently — on
 * any fetch failure it renders the nav without counts and drops the shelf note.
 * Hidden below `lg`; primary nav stays reachable in the top app bar on mobile.
 */
export async function Sidebar(): Promise<JSX.Element> {
  let libraryCount: number | null = null;
  let untouchedCount: number | null = null;

  try {
    const { games } = await getProfile();
    libraryCount = games.length;
    untouchedCount = games.filter((game) => game.playtime.total === 0).length;
  } catch {
    // Degrade: render nav chrome without counts.
  }

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-bg px-4 py-7 lg:block">
      <SidebarNav libraryCount={libraryCount} />

      {untouchedCount !== null && untouchedCount > 0 && (
        <div className="mt-7">
          <p className="px-2.5 pb-3 text-caption font-medium uppercase tracking-widest text-text-3">
            This shelf
          </p>
          <p className="px-2.5 font-serif text-caption italic leading-relaxed text-text-3">
            <span className="tabular-nums not-italic text-text-2">{untouchedCount}</span> of your
            games are still untouched — waiting for their first session.
          </p>
        </div>
      )}
    </aside>
  );
}
