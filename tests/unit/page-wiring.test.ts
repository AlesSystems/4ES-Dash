/**
 * tests/unit/page-wiring.test.ts
 *
 * Red-first source assertion for AC3 (bug-01):
 * - app/page.tsx must NOT contain `achievementPercent={null}`
 * - app/page.tsx must reference AchievementKpiSection inside a Suspense fallback
 *   of AchievementKpiSkeleton
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const pageSrc = fs.readFileSync(
  path.resolve(__dirname, '../../app/page.tsx'),
  'utf8',
);

describe('app/page.tsx wiring (bug-01)', () => {
  it('no longer contains the hardcoded achievementPercent={null}', () => {
    expect(pageSrc).not.toContain('achievementPercent={null}');
  });

  it('references AchievementKpiSection', () => {
    expect(pageSrc).toContain('AchievementKpiSection');
  });

  it('references AchievementKpiSkeleton as Suspense fallback', () => {
    expect(pageSrc).toContain('AchievementKpiSkeleton');
  });
});
