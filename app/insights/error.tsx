'use client';

import { RouteError } from '@/components/states/RouteError';

export default function InsightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Couldn't load your insights"
      description="We had trouble fetching your gaming insights. Please try again."
    />
  );
}
