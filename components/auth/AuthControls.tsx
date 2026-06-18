import { getSessionUser } from '@/server/auth';
import { getProfile } from '@/server/repositories/profile';
import { SignInButton } from '@/components/auth/SignInButton';
import { UserMenu } from '@/components/auth/UserMenu';

/**
 * Server component that switches the app-bar auth control on session state:
 *  - signed in  → <UserMenu> (avatar + persona, sign-out, link to settings)
 *  - logged out → <SignInButton> ("Sign in with Steam")
 *
 * Fetches the persona/avatar for the signed-in user (cache-deduped with the
 * header's own profile read) and degrades to placeholders on any failure — the
 * header must never crash.
 */
const PLACEHOLDER_AVATAR =
  'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';

export async function AuthControls(): Promise<JSX.Element> {
  const session = await getSessionUser();
  if (!session) {
    return <SignInButton />;
  }

  let personaName = 'Steam user';
  let avatarUrl = PLACEHOLDER_AVATAR;
  try {
    const { profile } = await getProfile(session.steamId);
    personaName = profile.personaName;
    avatarUrl = profile.avatar.medium;
  } catch {
    // Degrade to placeholders — never crash the header.
  }

  return <UserMenu personaName={personaName} avatarUrl={avatarUrl} />;
}
