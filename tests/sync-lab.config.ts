import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "sync-lab.playwright.ts", workers: 1, timeout: 90000,
  expect: { timeout: 20000 },
  use: { baseURL: process.env.NEO_TEST_URL ?? "https://calculator-lab.hwctools.site", headless: true, trace: "retain-on-failure" },
  outputDir: "/tmp/neo-sync-lab-playwright-results",
});
