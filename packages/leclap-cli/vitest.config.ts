import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

// Standalone Vitest config so `pnpm --filter @leclap/cli test` resolves this package's own tests/
// dir (the root config's include globs are repo-root-relative). Mirrors @leclap/mcp.
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
