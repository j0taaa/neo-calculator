import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "retirement-production.playwright.ts", workers: 1,
  timeout: 180000, expect: { timeout: 30000 },
  use: { baseURL: process.env.NEO_TEST_URL ?? "https://calculator.hwctools.site", headless: true, trace: "retain-on-failure" },
  outputDir: "/tmp/neo-retire-public-browser-results",
});
