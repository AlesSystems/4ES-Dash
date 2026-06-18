/**
 * Account settings — /settings
 *
 * Protected by middleware (unauthenticated → sign-in). RSC shell with minimal
 * client islands for the interactive controls:
 *   - PrivacyForm        — who can see my dashboard (public/friends-only/private)
 *   - ResyncButton       — manually re-run the backfill
 *   - DeleteAccountForm  — delete account & all data (type-to-confirm)
 *
 * All actions are scoped to the authenticated session user (see actions.ts).
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Privacy } from '@prisma/client';
import { getSessionUser } from '@/server/auth';
import { prisma } from '@/server/db';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { PrivacyForm } from './PrivacyForm';
import { ResyncButton } from './ResyncButton';
import { DeleteAccountForm } from './DeleteAccountForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your 4ES Dash privacy and account.',
};

const SHELL = 'mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8';

export default async function SettingsPage(): Promise<JSX.Element> {
  const session = await getSessionUser();
  if (!session) {
    redirect('/api/auth/signin');
  }

  const user = await prisma.user.findUnique({
    where: { steamId: session.steamId },
    select: { privacy: true },
  });
  const privacy: Privacy = user?.privacy ?? 'private';

  return (
    <main className={SHELL}>
      <h1 className="font-serif text-h1 font-normal text-text-1">Settings</h1>

      <section className="mt-8 border-t border-border pt-8">
        <PrivacyForm current={privacy} />
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-h3 font-medium text-text-1">Sync</h2>
        <p className="mb-3 mt-1 text-body text-text-2">
          Refresh your profile, library, and today&rsquo;s snapshot from Steam.
        </p>
        <ResyncButton />
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-h3 font-medium text-text-1">Session</h2>
        <p className="mb-3 mt-1 text-body text-text-2">Sign out of 4ES Dash on this device.</p>
        <SignOutButton />
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <DeleteAccountForm />
      </section>
    </main>
  );
}
