import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Default to node; DOM tests opt in per-file with `// @vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Migrate the SQLite test DB once before any worker starts (integration tests
    // open the real database — see tests/integration/snapshot.test.ts).
    globalSetup: ['./tests/global-setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Scope the floor to the logic core. app/ + components/ are presentational
      // and exercised by E2E, not unit tests; including them would make the
      // threshold meaningless. Measure what we actually unit-test.
      include: ['lib/**', 'server/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts', '**/index.ts'],
      reporter: ['text-summary', 'html'],
      // Ratchet floor — set a few points below the current baseline (91% lines /
      // 88% branches / 88% functions). Raise these over time; never lower them.
      thresholds: {
        lines: 88,
        statements: 88,
        functions: 85,
        branches: 85,
      },
    },
  },
});
