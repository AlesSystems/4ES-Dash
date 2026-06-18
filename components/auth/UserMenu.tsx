'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut, Settings } from 'lucide-react';
import { signOut } from 'next-auth/react';

const PLACEHOLDER_AVATAR =
  'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';

interface UserMenuProps {
  personaName: string;
  avatarUrl: string;
}

/**
 * UserMenu — signed-in user menu in the app bar.
 *
 * "use client" — needs state (open/closed) and DOM event listeners.
 * Receives personaName + avatarUrl as props; does NOT call useSession so no
 * SessionProvider is required at the RSC boundary.
 *
 * A11y: real <button> trigger with aria-haspopup/aria-expanded/aria-controls;
 * role="menu" container; role="menuitem" items; Escape closes; focus returns
 * to trigger on close.
 */
export function UserMenu({ personaName, avatarUrl }: UserMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const resolvedAvatar = avatarUrl || PLACEHOLDER_AVATAR;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${personaName} — open user menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-body font-medium text-text-1 transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <Image
          src={resolvedAvatar}
          alt={`${personaName}'s avatar`}
          width={28}
          height={28}
          sizes="28px"
          className="rounded-full shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_AVATAR;
          }}
        />
        <span className="hidden sm:block max-w-[120px] truncate">{personaName}</span>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-surface py-1 shadow-md"
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-body text-text-1 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Settings strokeWidth={1.75} className="h-4 w-4 shrink-0 text-text-3" aria-hidden />
            Settings
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: '/' });
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-body text-text-1 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <LogOut strokeWidth={1.75} className="h-4 w-4 shrink-0 text-text-3" aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
