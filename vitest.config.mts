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
  },
});
