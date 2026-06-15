import { EyeOff, Info, Lock, PackageOpen, type LucideIcon } from 'lucide-react';
import type { UnavailableReason } from '@/lib/result';

/**
 * Designed empty state for a typed {@link UnavailableReason} (issue #14).
 *
 * Every T2/T4 feature that returns `{ available: false, reason }` renders this
 * instead of crashing or showing a silent zero. The icon + default copy are
 * chosen per reason; callers may override the title/description for context.
 */
export interface UnavailableStateProps {
  reason: UnavailableReason;
  title?: string;
  description?: string;
  className?: string;
}

const PRESET: Record<UnavailableReason, { icon: LucideIcon; title: string; description: string }> =
  {
    private: {
      icon: Lock,
      title: 'Hidden (private profile)',
      description: 'This data is only visible when the Steam profile is public.',
    },
    'no-achievements': {
      icon: PackageOpen,
      title: 'No achievements',
      description: 'This game has no achievements to track.',
    },
    'metadata-unavailable': {
      icon: Info,
      title: 'Store metadata unavailable',
      description: 'Steam’s store details could not be loaded right now.',
    },
    'not-tracked': {
      icon: EyeOff,
      title: 'Not tracked yet',
      description: 'This needs more history than we have collected so far.',
    },
    empty: {
      icon: PackageOpen,
      title: 'Nothing to show',
      description: 'There’s no data for this window.',
    },
    unknown: {
      icon: Info,
      title: 'Unavailable',
      description: 'This data could not be loaded.',
    },
  };

export function UnavailableState({
  reason,
  title,
  description,
  className,
}: UnavailableStateProps): JSX.Element {
  const preset = PRESET[reason];
  const Icon = preset.icon;

  return (
    <div
      role="status"
      className={['flex flex-col items-center justify-center gap-3 py-12 text-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon size={32} strokeWidth={1.75} className="text-text-3" aria-hidden />
      <p className="text-h3 font-medium text-text-1">{title ?? preset.title}</p>
      <p className="text-body text-text-2">{description ?? preset.description}</p>
    </div>
  );
}
