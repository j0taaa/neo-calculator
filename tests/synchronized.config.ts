import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "synchronized.playwright.ts", workers: 1, timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { baseURL: process.env.NEO_TEST_URL ?? "http://127.0.0.1:3307", headless: true, trace: "retain-on-failure" },
  outputDir: "/tmp/neo-synchronized-playwright-results",
});
