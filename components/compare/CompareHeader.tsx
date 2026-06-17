import { UserColumn } from './UserColumn';
import type { ComparedSide } from '@/server/repositories/compare';

export interface CompareHeaderProps {
  a: ComparedSide;
  b: ComparedSide;
}

/**
 * Side-by-side header for the compare page.
 * Renders UserColumn A on the left, a centered "vs" divider, and UserColumn B
 * on the right — mirroring the design in docs/design/project/friends-compare.jsx.
 */
export function CompareHeader({ a, b }: CompareHeaderProps): JSX.Element {
  return (
    <div
      className="mb-7 flex items-stretch border-y border-border py-6"
      aria-label="Comparison header"
    >
      {/* Side A */}
      <UserColumn side={a} align="left" />

      {/* Center "vs" divider */}
      <div className="flex w-20 shrink-0 flex-col items-center justify-center border-x border-border">
        <span className="font-serif text-h2 italic text-text-3">vs</span>
        <span className="mt-2 font-mono text-caption uppercase tracking-widest text-text-3">
          compare
        </span>
      </div>

      {/* Side B */}
      <UserColumn side={b} align="right" />
    </div>
  );
}
