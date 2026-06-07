import { defineConfig } from 'tsdown';

export default defineConfig([
  // Node.js build
  {
    entry: 'packages/core/src/index.ts',
    format: ['esm', 'cjs'],
    // tsdown >=0.20 defaults to fixed .mjs/.cjs when emitting both formats;
    // keep the ESM entry as index.js to match this package's exports/module fields.
    outExtensions: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
    sourcemap: true,
    dts: true,
    clean: true,
    minify: false,
    target: 'node22.14',
    platform: 'node',
  },
  // Browser build
  {
    entry: 'packages/core/src/browser.ts',
    format: ['esm'],
    sourcemap: true,
    dts: false,
    clean: false, // Don't clean to avoid deleting node build
    minify: false,
    target: 'es2022',
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'globalThis',
      'process': JSON.stringify({ env: { NODE_ENV: 'production' }, platform: 'browser', versions: {} })
    },
  }
]);
