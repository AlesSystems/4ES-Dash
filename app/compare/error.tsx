'use client';

import { RouteError } from '@/components/states/RouteError';

export default function CompareError({
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
      title="Couldn't load the compare view"
      description="We had trouble fetching data to compare. Please try again."
    />
  );
}
