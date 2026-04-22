import { defineConfig } from 'tsdown';

export default defineConfig([
  // Node.js build
  {
    entry: 'packages/core/src/index.ts',
    format: ['esm', 'cjs'],
    splitting: false,
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
    splitting: false,
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
