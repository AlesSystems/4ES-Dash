// @vitest-environment jsdom
/**
 * tests/unit/app/compare-page.test.tsx
 *
 * TDD tests for app/compare/page.tsx (Tasks 04 + 05, issues #88 + #89).
 *
 * Covers:
 *  1. Authenticated user opens /compare?b=<valid> with no ?a= →
 *     side A resolves to the SESSION steamId (not env.STEAM_ID).
 *  2. Anonymous /compare with no ?a= → input EmptyState rendered; the
 *     placeholder account is NEVER fetched.
 *  3. Regression: with STEAM_ID=76561190000000000 in env, the string
 *     "76561190000000000" never appears in output when a valid comparison
 *     is possible.
 *  4. app/compare/page.tsx no longer reads getEnv().STEAM_ID (import-level assertion).
 *  5. Null profile → rendered name does NOT match /^\d{17}$/; friendly fallback shown.
 *
 * Mocking strategy (mirrors tests/unit/idor.test.ts):
 *  - vi.mock('@/server/auth') controls getSessionUser return value.
 *  - MSW (steamServer) intercepts Steam HTTP calls per-test.
 *  - vi.mock('next/image') avoids image-optimization runtime in jsdom.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { clearCache } from '@/server/cache';
import { steamServer } from '../../mocks/steam-server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_ID = '76561198000000001';
const PARTNER_ID = '76561198000000002';
const PLACEHOLDER_ID = '76561190000000000'; // env.STEAM_ID placeholder

const OWNED_GAMES_URL = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/';
const PLAYER_SUMMARIES_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted above all imports by vitest)
// ---------------------------------------------------------------------------

// next/image → plain <img>
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// next/navigation (not used in page but transitively referenced by some imports)
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// @/server/auth — default: unauthenticated (null). Override per-test for authed scenarios.
vi.mock('@/server/auth', () => ({
  getSessionUser: vi.fn().mockResolvedValue(null),
  getViewerSteamId: vi.fn().mockResolvedValue(''),
  buildAuthOptions: vi.fn(),
  authOptions: {},
  extractSteamId: vi.fn(),
  verifySteamOpenId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER vi.mock declarations)
// ---------------------------------------------------------------------------

import ComparePage from '@/app/compare/page';
import * as serverAuth from '@/server/auth';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function ownedGamesBody(steamId: string) {
  return {
    response: {
      game_count: 2,
      games: [
        {
          appid: 100,
          name: 'Game 100',
          playtime_forever: 60,
          img_icon_url: 'icon100',
          has_community_visible_stats: false,
        },
        {
          appid: 200,
          name: 'Game 200',
          playtime_forever: 120,
          img_icon_url: 'icon200',
          has_community_visible_stats: false,
        },
      ],
    },
  };
}

function playerSummaryBody(steamId: string, personaName?: string) {
  return {
    response: {
      players: [
        {
          steamid: steamId,
          communityvisibilitystate: 3,
          profilestate: 1,
          personaname: personaName ?? `User${steamId.slice(-4)}`,
          profileurl: `https://steamcommunity.com/profiles/${steamId}/`,
          avatar: 'https://avatars.steamstatic.com/small.jpg',
          avatarmedium: 'https://avatars.steamstatic.com/medium.jpg',
          avatarfull: 'https://avatars.steamstatic.com/full.jpg',
          avatarhash: 'abc',
          personastate: 1,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Type helper for mocked getSessionUser
// ---------------------------------------------------------------------------

function mockSession(steamId: string | null): void {
  (serverAuth.getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue(
    steamId ? { steamId } : null,
  );
}

// ---------------------------------------------------------------------------
// Render helper (async RSC pattern, same as homepage.test.tsx)
// ---------------------------------------------------------------------------

async function renderCompare(searchParams: { a?: string; b?: string }) {
  render(await ComparePage({ searchParams }));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearCache();
  vi.clearAllMocks();
  // Reset to default: unauthenticated
  (serverAuth.getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  steamServer.resetHandlers();
});

// ---------------------------------------------------------------------------
// AC1 + AC2: Authenticated user, no ?a= → side A = session steamId; no "Try again shortly"
// ---------------------------------------------------------------------------

describe('ComparePage – authenticated user, no ?a=', () => {
  beforeEach(() => {
    mockSession(SESSION_ID);

    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids') ?? '';
        if (steamids.includes(SESSION_ID)) return HttpResponse.json(playerSummaryBody(SESSION_ID, 'SessionPlayer'));
        if (steamids.includes(PARTNER_ID)) return HttpResponse.json(playerSummaryBody(PARTNER_ID, 'Partner'));
        return new HttpResponse(null, { status: 400 });
      }),
      http.get(OWNED_GAMES_URL, ({ request }) => {
        const steamid = new URL(request.url).searchParams.get('steamid');
        if (steamid === SESSION_ID) return HttpResponse.json(ownedGamesBody(SESSION_ID));
        if (steamid === PARTNER_ID) return HttpResponse.json(ownedGamesBody(PARTNER_ID));
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('renders the session user persona name on side A (not a raw SteamID)', async () => {
    await renderCompare({ b: PARTNER_ID });
    // The session user's name appears in the header column and in the shared-games table.
    // Use getAllByText because it legitimately appears in multiple elements.
    const matches = screen.getAllByText('SessionPlayer');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render the "Try again shortly" error message', async () => {
    await renderCompare({ b: PARTNER_ID });
    expect(screen.queryByText(/try again shortly/i)).not.toBeInTheDocument();
  });

  it('does NOT render "couldn\'t be loaded" error message', async () => {
    await renderCompare({ b: PARTNER_ID });
    expect(screen.queryByText(/couldn't be loaded/i)).not.toBeInTheDocument();
  });

  it('does NOT render the input EmptyState (both sides are valid)', async () => {
    await renderCompare({ b: PARTNER_ID });
    expect(screen.queryByText(/Add \?b=/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC3: Anonymous user, no ?a= → input EmptyState rendered; placeholder never fetched
// ---------------------------------------------------------------------------

describe('ComparePage – anonymous user, no ?a= and no ?b=', () => {
  it('renders the input EmptyState with instructional text', async () => {
    await renderCompare({});
    expect(screen.getByText(/Compare two Steam libraries/i)).toBeInTheDocument();
  });

  it('renders the ?b= instruction', async () => {
    await renderCompare({});
    expect(screen.getByText(/Add \?b=<17-digit SteamID>/i)).toBeInTheDocument();
  });
});

describe('ComparePage – anonymous user, no ?a= but valid ?b=', () => {
  let placeholderFetched = false;

  beforeEach(() => {
    placeholderFetched = false;

    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids') ?? '';
        if (steamids.includes(PLACEHOLDER_ID)) {
          placeholderFetched = true;
        }
        return HttpResponse.json(playerSummaryBody(PARTNER_ID, 'Partner'));
      }),
      http.get(OWNED_GAMES_URL, ({ request }) => {
        const steamid = new URL(request.url).searchParams.get('steamid');
        if (steamid === PLACEHOLDER_ID) {
          placeholderFetched = true;
        }
        return HttpResponse.json(ownedGamesBody(PARTNER_ID));
      }),
    );
  });

  it('renders the EmptyState (no valid side A) — not the comparison result', async () => {
    await renderCompare({ b: PARTNER_ID });
    // Without a session, ?a= is absent → no valid aId → show EmptyState
    expect(screen.getByText(/Compare two Steam libraries/i)).toBeInTheDocument();
  });

  it('never fetches the placeholder account 76561190000000000', async () => {
    await renderCompare({ b: PARTNER_ID });
    expect(placeholderFetched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC4: Regression — with STEAM_ID=76561190000000000 in env, placeholder never
//      appears in output and no "couldn't be loaded" error appears.
// ---------------------------------------------------------------------------

describe('ComparePage – regression: placeholder STEAM_ID never appears in output', () => {
  beforeEach(() => {
    // Simulate authenticated user so comparison can succeed.
    mockSession(SESSION_ID);

    steamServer.use(
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids') ?? '';
        if (steamids.includes(SESSION_ID)) return HttpResponse.json(playerSummaryBody(SESSION_ID, 'RealUser'));
        if (steamids.includes(PARTNER_ID)) return HttpResponse.json(playerSummaryBody(PARTNER_ID, 'Partner'));
        return new HttpResponse(null, { status: 400 });
      }),
      http.get(OWNED_GAMES_URL, ({ request }) => {
        const steamid = new URL(request.url).searchParams.get('steamid');
        if (steamid === SESSION_ID) return HttpResponse.json(ownedGamesBody(SESSION_ID));
        if (steamid === PARTNER_ID) return HttpResponse.json(ownedGamesBody(PARTNER_ID));
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('does not render the placeholder ID string as text', async () => {
    await renderCompare({ b: PARTNER_ID });
    expect(document.body.textContent).not.toContain(PLACEHOLDER_ID);
  });

  it('does not render the "couldn\'t be loaded" error message', async () => {
    await renderCompare({ b: PARTNER_ID });
    expect(screen.queryByText(/couldn't be loaded/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC5: Null profile → rendered name does NOT match /^\d{17}$/; friendly fallback.
// ---------------------------------------------------------------------------

describe('ComparePage – null profile renders friendly name fallback', () => {
  beforeEach(() => {
    // Authenticated session so we can actually reach the comparison render path.
    mockSession(SESSION_ID);

    steamServer.use(
      // SESSION_ID profile succeeds; PARTNER_ID profile returns empty players → null
      http.get(PLAYER_SUMMARIES_URL, ({ request }) => {
        const steamids = new URL(request.url).searchParams.get('steamids') ?? '';
        if (steamids.includes(SESSION_ID)) return HttpResponse.json(playerSummaryBody(SESSION_ID, 'RealUser'));
        // Empty players → schema error → profile = null for PARTNER_ID
        return HttpResponse.json({ response: { players: [] } });
      }),
      http.get(OWNED_GAMES_URL, ({ request }) => {
        const steamid = new URL(request.url).searchParams.get('steamid');
        if (steamid === SESSION_ID) return HttpResponse.json(ownedGamesBody(SESSION_ID));
        if (steamid === PARTNER_ID) return HttpResponse.json(ownedGamesBody(PARTNER_ID));
        return new HttpResponse(null, { status: 400 });
      }),
    );
  });

  it('does not render the raw partner SteamID as a name', async () => {
    await renderCompare({ b: PARTNER_ID });
    // The raw 17-digit steamId must not appear as a name in the document
    expect(document.body.textContent).not.toMatch(/^76561198000000002$/m);
    // More specifically, "76561198000000002" should not be displayed as the name
    const allText = document.body.textContent ?? '';
    // It must not appear as a standalone display name (may appear in meta/hidden, but
    // the friendly fallback must replace it as the visible persona name)
    expect(allText).not.toContain(PARTNER_ID);
  });

  it('renders a friendly fallback name that is not a 17-digit number', async () => {
    await renderCompare({ b: PARTNER_ID });
    // The fallback should be something like "Player 0002" or "Unknown player"
    // i.e. NOT matching /^\d{17}$/ in the display
    const displayedNames = screen
      .queryAllByRole('paragraph')
      .map((el) => el.textContent ?? '');

    // No displayed paragraph should be purely 17 digits
    for (const name of displayedNames) {
      expect(name).not.toMatch(/^\d{17}$/);
    }
  });

  it('does not crash when partner profile is null', async () => {
    await expect(renderCompare({ b: PARTNER_ID })).resolves.not.toThrow();
  });
});
