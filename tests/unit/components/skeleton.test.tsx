// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass('animate-pulse');
  });

  it('renders with bg-surface-2 class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass('bg-surface-2');
  });

  it('is aria-hidden', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('merges a caller className onto the element', () => {
    const { container } = render(<Skeleton className="h-6 w-48" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass('h-6');
    expect(el).toHaveClass('w-48');
  });

  it('renders as a div', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('aria-hidden cannot be overridden by caller props', () => {
    // NIT a: spread comes before aria-hidden so the prop is always unconditional.
    // Passing aria-hidden={false} must still result in aria-hidden="true".
    const { container } = render(<Skeleton aria-hidden={false} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });
});
