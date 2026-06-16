import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    root: './',
    include: ['tests/**/*.test.ts'],
  },
});
