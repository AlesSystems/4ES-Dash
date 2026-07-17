/**
 * Onboarding route — /onboarding
 *
 * First-sign-in landing that bootstraps the user's dashboard (profile + owned
 * games + a baseline snapshot) via the rate-limited onboarding backfill. The
 * "Setting up your library…" skeleton paints immediately; the backfill streams
 * in inside a Suspense boundary so first paint is never blocked.
 *
 *  - Success         → "Your dashboard is ready" + link to the dashboard.
 *  - Private profile → designed locked state with a prompt to make it public.
 *  - Transient error → friendly retry message (never a stack trace).
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/server/auth';
import { runOnboardingBackfill } from '@/server/jobs/onboarding-backfill';
import { EmptyState } from '@/components/states/EmptyState';

export const dynamic = 'force-dynamic';

// Non-load-bearing safety budget for the first-login backfill. The achievement
// fan-out is bounded in code (ONBOARDING_UNLOCK_LIMIT in
// server/jobs/onboarding-backfill.ts), so this is only a ceiling. 60s is the
// Vercel Hobby maximum — raise to 300 on Pro after confirming the plan
// (plan-04 data-ops Vercel check). Mirrors app/settings/page.tsx. (theme-5 T2)
export const maxDuration = 60;

export const metadata: Metadata = {
  title: 'Setting up',
  description: 'Setting up your 4ES Dash library.',
};

const SHELL = 'px-4 py-16 sm:px-6 lg:px-10';

function OnboardingSkeleton(): JSX.Element {
  return (
    <div className="mx-auto max-w-md text-center" aria-busy="true" aria-live="polite">
      <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-surface-2" aria-hidden />
      <h1 className="mt-6 font-serif text-h1 font-normal text-text-1">Setting up your library…</h1>
      <p className="mt-2 text-body text-text-2">
        Fetching your Steam profile and games and seeding your first snapshot. This only happens
        once.
      </p>
      <div className="mt-8 space-y-3" aria-hidden>
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}

async function OnboardingRunner({ steamId }: { steamId: string }): Promise<JSX.Element> {
  const result = await runOnboardingBackfill(steamId);

  if (result.onboarded) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-serif text-h1 font-normal text-text-1">Your dashboard is ready</h1>
        <p className="mt-2 text-body text-text-2">
          We&rsquo;ve imported your library and started tracking your playtime.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-md bg-brand-500 px-4 py-2 text-body font-medium text-bg transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  if (result.reason === 'private') {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          title="Your Steam profile is private"
          description="To build your dashboard we need your profile and game details set to public. Update your Steam privacy settings, then re-sync from Settings."
        />
        <div className="mt-6 text-center">
          <Link
            href="/onboarding"
            className="text-body font-medium text-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Try again
          </Link>
        </div>
      </div>
    );
  }

  // Transient error — friendly retry, never a stack trace.
  return (
    <div className="mx-auto max-w-md">
      <EmptyState
        title="We couldn&rsquo;t finish setting up"
        description="Something went wrong reaching Steam. Your data is safe — please try again in a moment."
      />
      <div className="mt-6 text-center">
        <Link
          href="/onboarding"
          className="text-body font-medium text-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}

export default async function OnboardingPage(): Promise<JSX.Element> {
  const session = await getSessionUser();
  if (!session) {
    redirect('/api/auth/signin');
  }

  return (
    <main className={SHELL}>
      <Suspense fallback={<OnboardingSkeleton />}>
        <OnboardingRunner steamId={session.steamId} />
      </Suspense>
    </main>
  );
}
