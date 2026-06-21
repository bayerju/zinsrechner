import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3010",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    env: {
      SKIP_ENV_VALIDATION: "1",
      DATABASE_URL: "file:./db.sqlite",
      NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
      NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
