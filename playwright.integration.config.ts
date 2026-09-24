import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:3101', headless: true },
  webServer: { command: 'env NEXT_DIST_DIR=.next-integration yarn next dev --hostname 127.0.0.1 --port 3101', url: 'http://127.0.0.1:3101/login', timeout: 60_000, reuseExistingServer: false },
});
