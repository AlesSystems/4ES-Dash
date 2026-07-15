import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono, Source_Serif_4 } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AppHeader } from '@/components/layout/AppHeader';
import { HeaderSkeleton } from '@/components/layout/HeaderSkeleton';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarSkeleton } from '@/components/layout/SidebarSkeleton';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// Editorial display face for the warm "Wrapped" system (headings, big numerals).
// Italic is used for accents in headlines; include both styles.
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://4es-dash.vercel.app'),
  title: {
    default: '4ES Dash',
    template: '%s — 4ES Dash',
  },
  description:
    'A calm, information-dense personal Steam dashboard. Track playtime, achievements, library value, and more.',
};

export const viewport: Viewport = {
  themeColor: [
    // Next.js requires static literals here (CSS vars unsupported in metadata).
    // These mirror the --bg tokens in app/globals.css.
    { media: '(prefers-color-scheme: light)', color: '#f4ede1' },
    { media: '(prefers-color-scheme: dark)', color: '#141211' },
  ],
};

// Runs before first paint (injected into <head> via next/script beforeInteractive):
// applies a persisted light/dark choice by setting data-theme on <html>, so there
// is no flash of the default (dark) theme. If nothing is stored, the dark-first
// default rendered on the server stands.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${sourceSerif.variable}`}
    >
      <body className="min-h-screen bg-bg bg-grad font-sans text-body text-text-1 antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        {/* Shell streams behind its own Suspense boundaries (Theme 3, T2):
            the document — including {children}, which stays OUTSIDE both
            boundaries — flushes immediately while the shell's Steam-gated
            awaits resolve into geometry-matched skeletons. */}
        <Suspense fallback={<HeaderSkeleton />}>
          <AppHeader />
        </Suspense>
        <div className="flex">
          <Suspense fallback={<SidebarSkeleton />}>
            <Sidebar />
          </Suspense>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
