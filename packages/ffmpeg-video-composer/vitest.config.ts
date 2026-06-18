import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

// The core package owns its unit tests so `pnpm -r test` (from the repo root) runs them from
// this directory alongside the app suites. Tests resolve fixtures via the `@` alias / their own
// file location (not process.cwd()), so this runs the same from here or the repo root.
export default defineConfig({
  plugins: [
    // swc handles the transform so tsyringe's emitDecoratorMetadata is preserved (Vite's
    // default Oxc transform does not emit decorator metadata). swc reads this package's
    // tsconfig.json (experimentalDecorators + emitDecoratorMetadata).
    swc.vite(),
  ],
  // Vite 8 transforms with Oxc by default; disable it so swc is the only transformer.
  oxc: false,
  // Resolve TS path aliases (`@/*` -> ./src/*) natively from this package's tsconfig.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: false,
    environment: 'node',
    root: './',
    include: ['tests/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/e2e/**'],
    pool: 'threads',
    maxWorkers: undefined,
    isolate: true,
    // End-to-end compile tests share singleton DI state and FFmpeg build artifacts; running test
    // files concurrently lets renders clobber each other's segments.list/output paths.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,js}'],
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
