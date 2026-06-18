'use client';

import { RouteError } from '@/components/states/RouteError';

export default function HistoryError({
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
      title="Couldn't load your history"
      description="We had trouble fetching your playtime history. Please try again."
    />
  );
}
