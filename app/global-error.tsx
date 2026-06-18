'use client';

import './globals.css';
import { useEffect } from 'react';

/**
 * Global error boundary — replaces the root layout when the layout itself throws.
 * Must render its own <html><body>. Cannot use RouteError (which renders <main>
 * inside the layout) because this component IS the document root.
 * No stack trace is ever rendered; no error.message reaches the user.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: 'var(--bg)',
          color: 'var(--text-1)',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--text-2)', marginBottom: '1.5rem' }}>
            An unexpected error occurred. Please try again.
          </p>
          {/* Calls reset() directly — cannot use router.refresh() because this
              component is the document root and has no access to next/navigation. */}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-1)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
