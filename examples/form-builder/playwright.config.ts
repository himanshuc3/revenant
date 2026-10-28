import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the real app in Chromium.
 *
 *   npx playwright install chromium     # once, if you have no browser yet
 *   npm run e2e
 *
 * If Chromium is installed somewhere custom (CI image, sandbox), point
 * PW_CHROMIUM_PATH at the executable instead of installing another copy.
 */
const executablePath = process.env.PW_CHROMIUM_PATH;
const PORT = 5199;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1400, height: 900 },
    launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
