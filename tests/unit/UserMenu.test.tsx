// @vitest-environment jsdom
/**
 * tests/unit/UserMenu.test.tsx
 *
 * Render + a11y tests for <UserMenu> and a smoke test for <Landing>.
 *
 * <UserMenu> is a "use client" component that receives personaName + avatarUrl
 * as props (no useSession — avoids needing a SessionProvider in tests).
 * We mock next-auth/react's signOut so we can assert it was called.
 * We mock next/image to avoid the image-optimization runtime that is not
 * available in jsdom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// next/image → plain <img> in tests
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// next-auth/react — use vi.fn() directly in factory (avoids hoisting TDZ error)
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// next/link → plain <a>
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Component imports (AFTER mocks are registered)
// ---------------------------------------------------------------------------

import { UserMenu } from '@/components/auth/UserMenu';
import { SignInButton } from '@/components/auth/SignInButton';
import * as NextAuthReact from 'next-auth/react';

// Typed reference to the mocked signOut
const mockSignOut = NextAuthReact.signOut as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// UserMenu tests
// ---------------------------------------------------------------------------

describe('UserMenu', () => {
  const PROPS = {
    personaName: 'GabeN',
    avatarUrl: 'https://avatars.steamstatic.com/test_medium.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the persona name', () => {
    render(<UserMenu {...PROPS} />);
    expect(screen.getByText('GabeN')).toBeInTheDocument();
  });

  it('renders the avatar image with alt text', () => {
    render(<UserMenu {...PROPS} />);
    const img = screen.getByRole('img', { name: /GabeN's avatar/i });
    expect(img).toBeInTheDocument();
  });

  it('menu is closed by default (no menu items visible)', () => {
    render(<UserMenu {...PROPS} />);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('trigger button has aria-haspopup="menu" and aria-expanded="false" when closed', () => {
    render(<UserMenu {...PROPS} />);
    const trigger = screen.getByRole('button', { name: /GabeN/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the dropdown menu when the trigger is clicked', async () => {
    render(<UserMenu {...PROPS} />);
    const trigger = screen.getByRole('button', { name: /GabeN/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('menu contains a Settings link pointing to /settings', async () => {
    render(<UserMenu {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /GabeN/i }));
    const settingsLink = screen.getByRole('menuitem', { name: /settings/i });
    expect(settingsLink).toBeInTheDocument();
    // The underlying <a> should href to /settings
    const anchor = settingsLink.closest('a') ?? settingsLink.querySelector('a') ?? settingsLink;
    expect(anchor).toHaveAttribute('href', '/settings');
  });

  it('menu contains a Sign out button', async () => {
    render(<UserMenu {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /GabeN/i }));
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('Sign out button calls signOut with callbackUrl "/"', async () => {
    render(<UserMenu {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /GabeN/i }));
    const signOutBtn = screen.getByRole('menuitem', { name: /sign out/i });
    fireEvent.click(signOutBtn);
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });

  it('Escape key closes the open menu', async () => {
    render(<UserMenu {...PROPS} />);
    const trigger = screen.getByRole('button', { name: /GabeN/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('falls back gracefully when avatarUrl is empty string', () => {
    render(<UserMenu personaName="GabeN" avatarUrl="" />);
    // Should still render without throwing; fallback image rendered
    expect(screen.getByText('GabeN')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SignInButton smoke test
// ---------------------------------------------------------------------------

describe('SignInButton', () => {
  it('renders a button with accessible label containing "Steam"', () => {
    render(<SignInButton />);
    const btn = screen.getByRole('button', { name: /sign in with steam/i });
    expect(btn).toBeInTheDocument();
  });
});
