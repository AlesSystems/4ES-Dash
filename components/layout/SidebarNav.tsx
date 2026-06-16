'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Library, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowseItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Real count to show on the right, or null to omit. */
  count: number | null;
}

/**
 * Sidebar "Browse" navigation (client — needs the active route).
 *
 * Counts are passed in from the async {@link Sidebar} RSC so they reflect real
 * library data. Only real routes appear here (Dashboard, Library); decorative
 * entries from the mockup (Collections, Friends) are intentionally omitted —
 * see the degradation contract in CLAUDE.md.
 */
export function SidebarNav({ libraryCount }: { libraryCount: number | null }): JSX.Element {
  const pathname = usePathname();

  const items: BrowseItem[] = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard, count: null },
    { label: 'Library', href: '/library', icon: Library, count: libraryCount },
  ];

  return (
    <nav aria-label="Browse">
      <p className="px-2.5 pb-3 text-caption font-medium uppercase tracking-widest text-text-3">
        Browse
      </p>
      <ul className="flex flex-col gap-0.5" role="list">
        {items.map(({ label, href, icon: Icon, count }) => {
          const isActive = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-md px-2.5 py-2 text-body transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  isActive
                    ? 'bg-surface font-medium text-text-1'
                    : 'text-text-2 hover:bg-surface-2 hover:text-text-1',
                )}
              >
                {isActive && (
                  <span
                    className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-brand-500"
                    aria-hidden
                  />
                )}
                <Icon size={16} strokeWidth={1.75} aria-hidden />
                <span className="flex-1">{label}</span>
                {count !== null && (
                  <span className="font-mono text-caption tabular-nums text-text-3">{count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
