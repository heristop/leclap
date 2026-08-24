import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Standalone Vitest config (does not reuse vite.config.ts so the React Compiler and node-polyfill
 * plugins don't run during tests). Unit tests target framework-independent logic;
 * the `@/` alias mirrors the app's import alias.
 *
 * Coverage is enforced (>=80%) on the framework-independent feature logic. RN/React components
 * and hooks are out of scope here (they'd need jsdom + @testing-library, which aren't installed).
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirror vite.config.ts: the core package uses `@/core/...` internally, so a runtime value
      // import (e.g. `@/core/fonts`, `@/core/partials`) pulled into a test must resolve to the core
      // src, not this app's src. Must precede the general `@`.
      '@/core': path.resolve(projectDir, '../../packages/ffmpeg-video-composer/src/core'),
      '@': path.resolve(projectDir, 'src'),
    },
  },
  test: {
    environment: 'node',
    // Both trees: feature logic lives beside the source under src/, while the older
    // integration-flavoured suites live in tests/. The root config (vitest.config.js) globs
    // `apps/leclap-web/tests/**` too — leaving it out here meant `pnpm --filter @leclap/web test`
    // silently skipped those files and only `pnpm test:ci` ever ran them.
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/valueObjects/videoEdits.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
