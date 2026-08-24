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
  // Resolve TS path aliases (e.g. `@/*` -> packages/ffmpeg-video-composer/src/*) natively, replacing the
  // vite-tsconfig-paths plugin.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: false,
    environment: 'node',
    root: './',
    // Core and MCP tests live in their packages; repo-level ones in tests/. The web app is absent on
    // purpose — `pnpm --filter @leclap/web test` owns both of its trees (src/ and tests/) under the
    // app's own config. Globbing apps/leclap-web/tests/** here too ran those files twice under two
    // non-equivalent pipelines (this one transforms with swc so tsyringe's decorator metadata
    // survives, resolves tsconfig paths and serializes files; the app's uses raw Oxc, hand-written
    // aliases and parallel files) — so the first web test to touch a DI decorator or a tsconfig-only
    // alias would pass in one CI step and fail in the other, under the same filename.
    include: [
      'packages/ffmpeg-video-composer/tests/**/*.test.ts',
      'packages/leclap-mcp/tests/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    // Playwright specs live under e2e/ and import @playwright/test (not a vitest
    // dependency); they run via `pnpm test:e2e`, not the unit suite.
    exclude: [...configDefaults.exclude, '**/e2e/**'],
    pool: 'threads',
    maxWorkers: undefined,
    isolate: true,
    // Core ffmpeg tests share the repo-level build/ dir (segments.list, segment outputs), so
    // running test files concurrently makes them clobber each other intermittently. Serialize
    // files for deterministic runs.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['packages/ffmpeg-video-composer/src/**/*.{ts,js}'],
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
