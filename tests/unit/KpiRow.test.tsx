// @vitest-environment jsdom
/**
 * tests/unit/KpiRow.test.tsx
 *
 * Red-first tests for AC1 (bug-01):
 * - AchievementKpiCell: percent={42} → "42%"; percent={0} → "0%"; percent={null} → "—"
 * - KpiCell is importable as a named export
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AchievementKpiCell, KpiCell } from '@/components/dashboard/KpiRow';

describe('KpiCell (named export)', () => {
  it('is importable and renders its label and value', () => {
    render(<KpiCell label="Hours played" value={100} unit="h" />);
    expect(screen.getByText('Hours played')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});

describe('AchievementKpiCell', () => {
  it('renders the percent as "42%" when percent is 42', () => {
    render(<AchievementKpiCell percent={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    // Must not show "—"
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders "0%" (honest real zero) when percent is 0', () => {
    render(<AchievementKpiCell percent={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders "—" designed state when percent is null — no "%"', () => {
    render(<AchievementKpiCell percent={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });
});
