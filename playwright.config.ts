import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  maxFailures: process.env.CI ? 3 : undefined,
  timeout: 45_000,
  expect: { timeout: 5_000 },
  outputDir: "test-results",
  reporter: [[process.env.CI ? "github" : "list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173/fitness-pwa/",
    browserName: "chromium",
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    reducedMotion: "reduce",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: "narrow", use: { viewport: { width: 320, height: 852 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 } } },
    { name: "landscape", use: { viewport: { width: 844, height: 390 } } },
  ],
  webServer: {
    command:
      "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort --base /fitness-pwa/",
    url: "http://127.0.0.1:4173/fitness-pwa/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
