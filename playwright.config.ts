import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Edge routes (like /api/og) compile on first hit in dev mode — give extra time
    navigationTimeout: 30_000,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [{
    command: 'node e2e/fixtures/hypersnap-server.cjs',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: false,
  }, {
    command: 'npm run dev -- --hostname 127.0.0.1',
    env: { NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 'ci-mock-project-id', NEXT_PUBLIC_HYPERSNAP_URL: 'http://127.0.0.1:3001', HYPERSNAP_FALLBACK_URL: 'http://127.0.0.1:3001' },
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
  }],
});
