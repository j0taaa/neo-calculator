import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "design-proposals.playwright.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.NEO_TEST_URL ?? "http://127.0.0.1:3307",
    headless: true,
    trace: "retain-on-failure",
  },
  outputDir: "/tmp/neo-design-playwright-results",
});
