import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8792',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    headless: true,
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:8792/painel.html',
    reuseExistingServer: false,
    timeout: 15_000,
    env: {
      ...process.env,
      DATA_DIR: 'tests/.data',
      CACHE_DIR: 'tests/.cache',
    },
  },
});
