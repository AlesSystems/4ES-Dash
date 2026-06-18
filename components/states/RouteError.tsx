'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

/**
 * Shared visual + behaviour for every route-segment error.tsx.
 *
 * - Logs the error via useEffect (diagnostics only).
 * - Never renders error.message or error.stack — no raw trace reaches the user.
 * - Retry button calls both reset() (Next.js segment reset) and router.refresh()
 *   so a transient data error re-runs the server render without a full page reload.
 */
export function RouteError({
  error,
  reset,
  title = 'Something went wrong',
  description = 'We couldn’t load your Steam data. Please try again.',
}: RouteErrorProps): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    // Surface for diagnostics; no raw error is shown to the user.
    console.error(error);
  }, [error]);

  function handleRetry() {
    reset();
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-content flex-col items-center justify-center gap-3 px-4 py-12 text-center sm:px-6 lg:px-8">
      <TriangleAlert className="text-danger" size={32} strokeWidth={1.75} aria-hidden />
      <h2 className="text-h3 font-medium text-text-1">{title}</h2>
      <p className="text-body text-text-2">{description}</p>
      <button
        type="button"
        onClick={handleRetry}
        className="mt-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-body text-text-1 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        Retry
      </button>
    </main>
  );
}
