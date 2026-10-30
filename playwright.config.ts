import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:4173${process.env.PROOFLAB_BASE_PATH || "/"}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: `http://127.0.0.1:4173${process.env.PROOFLAB_BASE_PATH || "/"}`,
    env: { BASE_PATH: process.env.PROOFLAB_BASE_PATH || "/" },
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
