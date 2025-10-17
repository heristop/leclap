import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'packages/core/src/index.ts',
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  dts: true,
  clean: true,
  minify: false,
  target: 'node22.14', // Based on engines.node >= 22.14.0
  nodeProtocol: false, // Keep imports as-is
});
