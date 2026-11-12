import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  outputDir: 'node_modules/.tmp/portal-browser-results',
  use: {
    baseURL: 'http://127.0.0.1:5194',
    channel: 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5194 --strictPort',
    url: 'http://127.0.0.1:5194',
    reuseExistingServer: false,
    env: {
      VITE_API_URL: 'http://127.0.0.1:5160',
      VITE_APPOINTMENT_URL: 'http://127.0.0.1:5195',
    },
  },
});
