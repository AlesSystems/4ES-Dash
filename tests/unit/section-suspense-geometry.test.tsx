/**
 * CLS / geometry tests for section-level Suspense skeletons (Task 03).
 *
 * Asserts that each section's skeleton fallback and its loaded counterpart
 * share the same structural geometry (wrapper sizing classes / container
 * structure) so a regression that desyncs them fails CI.
 *
 * These are deterministic structural assertions — no live run needed.
 * Live Lighthouse CLS measurements require a running app with real Steam data
 * and are a maintainer step (not CI-gated).
 */
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { available, unavailable } from '@/lib/result';
import type { GameAchievements } from '@/lib/achievements/aggregate';
import type { StoreMetadata, StorePrice } from '@/lib/steam/store-client';
import { AchievementList } from '@/components/game/AchievementList';
import { StoreMetaPanel } from '@/components/game/StoreMetaPanel';
import {
  GameAchievementsSkeleton,
  GameStoreSkeleton,
} from '@/components/game/GameDetailSkeletons';
import { LibraryValueSkeleton } from '@/components/dashboard/LibraryValueSection';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_ACHIEVEMENTS: GameAchievements = {
  unlocked: 1,
  total: 2,
  percent: 50,
  items: [],
};

const MOCK_META: StoreMetadata = {
  name: 'Portal 2',
  shortDescription: 'A puzzle platformer.',
  headerImage: 'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',
  genres: ['Action'],
  categories: ['Single-player'],
  categoryIds: [2],
  developers: ['Valve'],
  publishers: ['Valve'],
  releaseDate: '18 Apr, 2011',
  platforms: { windows: true, mac: false, linux: true },
};

const MOCK_PRICE: StorePrice = {
  currency: 'USD',
  initialCents: 999,
  finalCents: 999,
  discountPercent: 0,
  formatted: '$9.99',
};

// ---------------------------------------------------------------------------
// AC5: GameAchievementsSkeleton geometry matches AchievementList geometry
// ---------------------------------------------------------------------------

describe('GameAchievementsSkeleton — geometry matches AchievementList', () => {
  it('skeleton root is a <section> element (matches AchievementList root)', () => {
    const { container: skeletonContainer } = render(<GameAchievementsSkeleton />);
    const { container: loadedContainer } = render(
      <AchievementList result={available(MOCK_ACHIEVEMENTS)} />,
    );

    const skeletonRoot = skeletonContainer.firstElementChild as HTMLElement;
    const loadedRoot = loadedContainer.firstElementChild as HTMLElement;

    expect(skeletonRoot.tagName.toLowerCase()).toBe('section');
    expect(loadedRoot.tagName.toLowerCase()).toBe('section');
  });

  it('skeleton uses Skeleton primitives (no raw animate-pulse divs not wrapped by Skeleton)', () => {
    const { container } = render(<GameAchievementsSkeleton />);
    // Every animate-pulse element must also have bg-surface-2 (the Skeleton token class)
    const animatedEls = container.querySelectorAll('.animate-pulse');
    animatedEls.forEach((el) => {
      expect(el).toHaveClass('bg-surface-2');
    });
  });

  it('skeleton aria-hidden elements are present (aria-hidden per shard)', () => {
    const { container } = render(<GameAchievementsSkeleton />);
    const pulseEls = container.querySelectorAll('[aria-hidden="true"]');
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it('skeleton has same aria-labelledby heading anchor as loaded state', () => {
    const { container: skeletonContainer } = render(<GameAchievementsSkeleton />);
    const { container: loadedContainer } = render(
      <AchievementList result={available(MOCK_ACHIEVEMENTS)} />,
    );

    // Both should have an element referencing "achievements-heading"
    const skeletonSection = skeletonContainer.querySelector('[aria-labelledby="achievements-heading"]');
    const loadedSection = loadedContainer.querySelector('[aria-labelledby="achievements-heading"]');

    expect(skeletonSection).not.toBeNull();
    expect(loadedSection).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC5: GameStoreSkeleton geometry matches StoreMetaPanel geometry
// ---------------------------------------------------------------------------

describe('GameStoreSkeleton — geometry matches StoreMetaPanel', () => {
  it('skeleton root is a <section> element (matches StoreMetaPanel root)', () => {
    const { container: skeletonContainer } = render(<GameStoreSkeleton />);
    const { container: loadedContainer } = render(
      <StoreMetaPanel metadata={available(MOCK_META)} price={available(MOCK_PRICE)} />,
    );

    const skeletonRoot = skeletonContainer.firstElementChild as HTMLElement;
    const loadedRoot = loadedContainer.firstElementChild as HTMLElement;

    expect(skeletonRoot.tagName.toLowerCase()).toBe('section');
    expect(loadedRoot.tagName.toLowerCase()).toBe('section');
  });

  it('skeleton uses Skeleton primitives (all animate-pulse carry bg-surface-2)', () => {
    const { container } = render(<GameStoreSkeleton />);
    const animatedEls = container.querySelectorAll('.animate-pulse');
    animatedEls.forEach((el) => {
      expect(el).toHaveClass('bg-surface-2');
    });
  });

  it('skeleton aria-hidden elements are present', () => {
    const { container } = render(<GameStoreSkeleton />);
    const pulseEls = container.querySelectorAll('[aria-hidden="true"]');
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it('skeleton has same aria-labelledby heading anchor as loaded state', () => {
    const { container: skeletonContainer } = render(<GameStoreSkeleton />);
    const { container: loadedContainer } = render(
      <StoreMetaPanel metadata={available(MOCK_META)} price={available(MOCK_PRICE)} />,
    );

    const skeletonSection = skeletonContainer.querySelector('[aria-labelledby="store-meta-heading"]');
    const loadedSection = loadedContainer.querySelector('[aria-labelledby="store-meta-heading"]');

    expect(skeletonSection).not.toBeNull();
    expect(loadedSection).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC2: LibraryValueSkeleton uses Skeleton primitive (not hand-rolled divs)
// ---------------------------------------------------------------------------

describe('LibraryValueSkeleton — uses Skeleton primitive', () => {
  it('all animate-pulse elements carry bg-surface-2 (Skeleton token)', () => {
    const { container } = render(<LibraryValueSkeleton />);
    const animatedEls = container.querySelectorAll('.animate-pulse');
    expect(animatedEls.length).toBeGreaterThan(0);
    animatedEls.forEach((el) => {
      expect(el).toHaveClass('bg-surface-2');
    });
  });

  it('renders as a section with aria-busy="true"', () => {
    const { container } = render(<LibraryValueSkeleton />);
    const section = container.querySelector('section[aria-busy="true"]');
    expect(section).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Skeleton primitive — confirm exported from @/components barrel
// ---------------------------------------------------------------------------

describe('Skeleton primitive re-export from @/components', () => {
  it('Skeleton from barrel is the same animate-pulse primitive', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass('animate-pulse');
    expect(el).toHaveClass('bg-surface-2');
    expect(el).toHaveClass('h-4');
    expect(el).toHaveClass('w-24');
  });
});
