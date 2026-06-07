import { defineConfig, devices } from '@playwright/test';

// E2E config for the in-browser FFmpeg WASM template-compilation checks.
// Reuses a running dev server on :5174, or starts one.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 20 * 60 * 1000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
