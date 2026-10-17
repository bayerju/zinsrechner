import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3011";

export default defineConfig({
  testDir: "./tests/e2e",
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "pnpm test:e2e:webserver",
        url: baseURL,
        // Fresh CI runners download and initialize the local Convex backend.
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
          SKIP_ENV_VALIDATION: "1",
        },
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
