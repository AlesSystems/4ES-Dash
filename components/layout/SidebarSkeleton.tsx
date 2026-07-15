import { SidebarNav } from './SidebarNav';

/*
 * Static Suspense fallback for the app-shell sidebar (Theme 3, T1).
 *
 * Synchronous server component: no data access, no server/** imports, no
 * async-RSC children (per the T1 binding rule — only genuinely "use client"
 * components may be reused for real; SidebarNav qualifies).
 *
 * Renders the real client SidebarNav with a null count — byte-identical
 * markup to the degraded resolved Sidebar, so the Suspense swap is visually
 * inert (the Library count chip and the "This shelf" note appear only once
 * real data resolves, inline, without shifting surrounding layout).
 *
 * Layout-affecting classes are byte-identical to Sidebar's <aside>;
 * tests/unit/sidebar-skeleton.test.tsx pins both files.
 */
export function SidebarSkeleton(): JSX.Element {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-bg px-4 py-7 lg:block">
      <SidebarNav libraryCount={null} />
    </aside>
  );
}
