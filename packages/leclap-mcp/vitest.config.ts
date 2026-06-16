import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

// Standalone Vitest config so `pnpm --filter @leclap/mcp test` resolves this package's own
// tests/ dir (the root config's include globs are repo-root-relative and don't match when
// vitest runs from this package). Tests import the core (`ffmpeg-video-composer`), which uses
// tsyringe decorators — hence the swc transform (preserves emitDecoratorMetadata) and the
// reflect-metadata polyfill, mirroring the root config.
export default defineConfig({
  plugins: [swc.vite()],
  oxc: false,
  test: {
    globals: false,
    environment: 'node',
    root: projectDir,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['reflect-metadata'],
  },
});
