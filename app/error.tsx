'use client';

import { RouteError } from '@/components/states/RouteError';

// Route-level error boundary for the home segment (Next.js requires "use client").
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} />;
}
