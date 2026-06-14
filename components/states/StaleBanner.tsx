import { Clock } from 'lucide-react';

export interface StaleBannerProps {
  className?: string;
}

export function StaleBanner({ className }: StaleBannerProps): JSX.Element {
  return (
    <div
      role="status"
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-md border border-border bg-surface-2',
        'px-3 py-1.5',
        'text-caption text-warning',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Clock size={16} strokeWidth={1.75} aria-hidden />
      <span className="text-text-2">Data may be outdated</span>
    </div>
  );
}
