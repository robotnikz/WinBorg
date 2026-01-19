import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false, // Electron doesn't support parallel well usually
  forbidOnly: !!process.env.CI,
  // Keep CI strict: no retries masking flakes; retain traces for debugging.
  retries: 0,
  workers: 1, // Electron requirement often
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'html',
  use: {
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
  },
  projects: [
    {
      name: 'electron',
    },
  ],
});
