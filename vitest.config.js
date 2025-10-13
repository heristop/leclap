import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import checker from 'vite-plugin-checker';

export default defineConfig({
  plugins: [swc.vite(), tsconfigPaths(), checker({ typescript: true })],
  test: {
    globals: false,
    environment: 'node',
    root: './',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['src'],
    },
  },
});
