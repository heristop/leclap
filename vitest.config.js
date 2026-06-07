import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // swc handles the transform so tsyringe's emitDecoratorMetadata is preserved (Vite's
    // default Oxc transform does not emit decorator metadata).
    swc.vite(),
  ],
  // Vite 8 transforms with Oxc by default; disable it so the swc plugin above is the only
  // transformer (this also silences the legacy `esbuild: false` deprecation warning).
  oxc: false,
  // Resolve TS path aliases (e.g. `@/*` -> packages/core/src/*) natively, replacing the
  // vite-tsconfig-paths plugin.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: false,
    environment: 'node',
    root: './',
    // Core tests live in the core package; web-app unit tests live under its tests/ dir.
    include: ['packages/core/tests/**/*.test.ts', 'apps/le-clap-web/tests/**/*.test.ts'],
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
