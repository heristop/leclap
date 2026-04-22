import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import checker from 'vite-plugin-checker';

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
    pool: 'threads',
    maxWorkers: undefined,
    isolate: true,
    fileParallelism: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['packages/core/src/**/*.{ts,js}'],
      exclude: ['**/node_modules/**', '**/tests/**', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
