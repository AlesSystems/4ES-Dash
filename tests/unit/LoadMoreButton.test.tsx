// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadMoreButton } from '@/components/library/LoadMoreButton';

const mockReplace = vi.fn();
let mockSearch = '';

// Mock next/navigation so the client leaf can render in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearch),
  usePathname: () => '/library',
}));

function lastReplaceCall(): { params: URLSearchParams; options: unknown } {
  const call = mockReplace.mock.calls.at(-1);
  const url = call?.[0] as string;
  return { params: new URLSearchParams(url.split('?')[1] ?? ''), options: call?.[1] };
}

describe('LoadMoreButton', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockSearch = '';
  });

  it('load more advances limit in the URL and preserves filters', () => {
    mockSearch = 'sort=name&limit=24';
    render(<LoadMoreButton remaining={76} />);
    fireEvent.click(screen.getByRole('button', { name: /load 24 more/i }));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const { params, options } = lastReplaceCall();
    expect(params.get('sort')).toBe('name');
    expect(params.get('limit')).toBe('48');
    expect(options).toEqual({ scroll: false });
  });

  it('first click with no limit param goes to 48', () => {
    // Fresh /library visit — the default 24 is applied server-side only and is
    // never in the URL. A naive `searchParams.get('limit')` is null here; the
    // component must derive the current limit via parseLimitParam.
    mockSearch = 'view=list&q=hades';
    render(<LoadMoreButton remaining={76} />);
    fireEvent.click(screen.getByRole('button', { name: /load 24 more/i }));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const { params, options } = lastReplaceCall();
    expect(params.get('limit')).toBe('48');
    expect(params.get('view')).toBe('list');
    expect(params.get('q')).toBe('hades');
    expect(options).toEqual({ scroll: false });
  });

  it('caps the button label by the remaining count', () => {
    render(<LoadMoreButton remaining={10} />);
    expect(screen.getByRole('button', { name: /load 10 more/i })).toBeInTheDocument();
  });
});
