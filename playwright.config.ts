/**
 * Playwright configuration for E2E tests.
 * Uses Electron mode for testing the packaged application.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000, // Electron tests can be slow
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Electron tests must run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Only one worker for Electron
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
