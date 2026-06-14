'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';

// Route-level error boundary (Next.js requires this to be a Client Component).
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for diagnostics; no raw error is shown to the user.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-content flex-col items-center justify-center gap-3 px-4 py-12 text-center sm:px-6 lg:px-8">
      <TriangleAlert className="text-danger" size={32} strokeWidth={1.75} aria-hidden />
      <h2 className="text-h3 font-medium text-text-1">Something went wrong</h2>
      <p className="text-body text-text-2">
        We couldn&apos;t load your Steam data. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-body text-text-1 transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        Try again
      </button>
    </main>
  );
}
