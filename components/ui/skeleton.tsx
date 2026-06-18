import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Token-styled pulse primitive for skeleton loading states.
 * Server-safe — no "use client".
 * The boundary (loading.tsx / Suspense fallback wrapper) owns aria-busy/aria-label;
 * each shard is aria-hidden.
 */
export function Skeleton({ className, ...props }: SkeletonProps): JSX.Element {
  return (
    <div {...props} aria-hidden className={cn('animate-pulse rounded bg-surface-2', className)} />
  );
}
