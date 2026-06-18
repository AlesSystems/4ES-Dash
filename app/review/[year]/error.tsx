'use client';

import { RouteError } from '@/components/states/RouteError';

export default function ReviewError({
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
      title="Couldn't load your year in review"
      description="We had trouble fetching your annual review data. Please try again."
    />
  );
}
