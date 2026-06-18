'use client';

import { RouteError } from '@/components/states/RouteError';

export default function GameError({
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
      title="Couldn't load game details"
      description="We had trouble fetching this game's data. Please try again."
    />
  );
}
