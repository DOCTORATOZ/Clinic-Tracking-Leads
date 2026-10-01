import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/contract', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3101', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'env NEXT_DIST_DIR=.next-contract yarn next dev --hostname 127.0.0.1 --port 3101', url: 'http://127.0.0.1:3101/login', timeout: 90000, reuseExistingServer: false },
});
