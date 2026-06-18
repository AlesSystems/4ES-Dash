'use client';

import { RouteError } from '@/components/states/RouteError';

export default function FriendsError({
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
      title="Couldn't load your friends"
      description="We had trouble fetching your friends list. Please try again."
    />
  );
}
