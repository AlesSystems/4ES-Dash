import { LineChart, Trophy, Library } from 'lucide-react';
import { SignInButton } from '@/components/auth/SignInButton';

/**
 * Logged-out landing — shown at `/` when there is no session and no featured
 * STEAM_ID fallback. Explains the app and offers the "Sign in with Steam" CTA.
 * Protected "my" views redirect unauthenticated visitors to sign-in; this is the
 * public face of the app. RSC (the only interactive piece is <SignInButton/>).
 */

const FEATURES = [
  {
    icon: LineChart,
    title: 'Playtime over time',
    body: 'Daily snapshots turn your library into a history — see trends, spikes, and idle time.',
  },
  {
    icon: Trophy,
    title: 'Achievements & insights',
    body: 'Completion, rarity, genre breakdowns, cost-per-hour, and a personal year in review.',
  },
  {
    icon: Library,
    title: 'Your whole library',
    body: 'Every owned game, value, and recently played — calm, information-dense, and private by default.',
  },
];

export function Landing(): JSX.Element {
  return (
    <main className="px-4 py-16 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-caption uppercase tracking-[0.32em] text-text-3">4ES Dash</p>
        <h1 className="mt-4 font-serif text-display-lg font-normal leading-tight text-text-1">
          Your Steam library, <span className="italic text-brand-500">measured.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-body text-text-2">
          A calm, information-dense personal dashboard for your Steam playtime, achievements, and
          library value. Sign in with Steam to build your own — your history stays private until you
          choose to share it.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton />
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-3" aria-label="Features">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border border-border bg-surface p-6 text-left">
            <Icon size={24} strokeWidth={1.75} className="text-brand-500" aria-hidden />
            <h2 className="mt-3 text-h3 font-medium text-text-1">{title}</h2>
            <p className="mt-1 text-body text-text-2">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
