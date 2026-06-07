import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    swc.vite(),
    tsconfigPaths(),
    // Disable TypeScript checking for tests - linting already covers this
    // checker({
    //   typescript: {
    //     tsconfigPath: './packages/core/tsconfig.json',
    //   },
    // }),
  ],
  test: {
    globals: false,
    environment: 'node',
    root: './',
    // Tests are co-located in the core package they cover.
    include: ['packages/core/tests/**/*.test.ts'],
    // Playwright specs live under e2e/ and import @playwright/test (not a vitest
    // dependency); they run via `pnpm test:e2e`, not the unit suite.
    exclude: [...configDefaults.exclude, '**/e2e/**'],
    pool: 'threads',
    maxWorkers: undefined,
    isolate: true,
    fileParallelism: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['packages/core/src/**/*.{ts,js}'],
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        // CLI executable bundle: standalone entry that imports from dist/, not unit-testable
        '**/cli/**',
      ],
    },
  },
});
