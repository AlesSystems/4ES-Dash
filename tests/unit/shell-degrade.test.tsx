/**
 * tests/unit/shell-degrade.test.tsx — Theme 3, T2 regression pin (TDD #5).
 *
 * "Shell degrades, never fabricates, when Steam rejects": with getProfile
 * rejecting (SteamApiError kind:"private") and getLevel rejecting, the
 * resolved AppHeader shows `Lv —` and a `—` total (never a fabricated zero),
 * and the resolved Sidebar renders the nav with libraryCount === null and no
 * shelf note. Pinned GREEN before the Suspense wiring lands and must stay
 * green after — Suspense changes WHERE the shell suspends, not how it degrades.
 *
 * ERR-0006: AppHeader's returned JSX embeds the ASYNC <AuthControls /> server
 * component (AppHeader.tsx:114), so `render(await AppHeader())` would throw
 * "Objects are not valid as a React child (found: [object Promise])" without
 * a SYNC stub — hence the mandatory vi.mock below. Sidebar needs no stub: its
 * only child nav is the 'use client' SidebarNav, so its return really is
 * synchronous. Pattern: render(await Component()) per
 * tests/unit/achievement-kpi-section.test.tsx:38-39.
 */

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SteamApiError } from '@/lib/steam/errors';

const STEAM_ID = '76561198000000000';

// (a) MANDATORY sync stub for the async AuthControls server component.
vi.mock('@/components/auth/AuthControls', () => ({
  AuthControls: () => <div data-testid="auth-controls-stub" />,
}));

// (b) Viewer resolution — fixed id, never hits session/env code.
const mockGetViewerSteamId = vi.fn();
vi.mock('@/server/auth', () => ({
  getViewerSteamId: (...args: unknown[]) => mockGetViewerSteamId(...args),
}));

// (c) getProfile rejects with a typed private error.
const mockGetProfile = vi.fn();
vi.mock('@/server/repositories/profile', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

// (d) getLevel rejects — required to actually reach `Lv —`.
const mockGetLevel = vi.fn();
vi.mock('@/server/repositories/level', () => ({
  getLevel: (...args: unknown[]) => mockGetLevel(...args),
}));

// NavLinks / MobileNav / SidebarNav are 'use client' and read the pathname.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// Import AFTER mocks.
import { AppHeader } from '@/components/layout/AppHeader';
import { Sidebar } from '@/components/layout/Sidebar';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetViewerSteamId.mockResolvedValue(STEAM_ID);
  mockGetProfile.mockRejectedValue(new SteamApiError({ kind: 'private' }));
  mockGetLevel.mockRejectedValue(new SteamApiError({ kind: 'private' }));
});

describe('shell degrades, never fabricates, when Steam rejects', () => {
  it('AppHeader shows `Lv —` and `—` total — never a fabricated zero', async () => {
    render(await AppHeader());

    // Level badge degrades to the placeholder…
    expect(screen.getByText('Lv —')).toBeInTheDocument();
    // …and the total-playtime cluster shows `—` next to "total".
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('total')).toBeInTheDocument();

    // Never fabricate numbers from failed fetches.
    expect(screen.queryByText('Lv 0')).not.toBeInTheDocument();
    expect(screen.queryByText(/^0(\.\d+)?h$/)).not.toBeInTheDocument();

    // The sync AuthControls stub rendered in place of the async component.
    expect(screen.getByTestId('auth-controls-stub')).toBeInTheDocument();
  });

  it('Sidebar renders nav with libraryCount null and no shelf note', async () => {
    render(await Sidebar());

    // Nav chrome survives the failure.
    expect(screen.getByRole('navigation', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();

    // libraryCount === null → no count chip on any nav row.
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();

    // untouchedCount === null → the "This shelf" note is dropped entirely.
    expect(screen.queryByText('This shelf')).not.toBeInTheDocument();
    expect(screen.queryByText(/still untouched/)).not.toBeInTheDocument();
  });
});
