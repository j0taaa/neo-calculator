import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "consolidated-calculator.playwright.ts", workers: 1,
  timeout: 180000, expect: { timeout: 30000 },
  use: { baseURL: process.env.NEO_TEST_URL ?? "http://127.0.0.1:3330", headless: true, trace: "retain-on-failure" },
  outputDir: "/tmp/neo-consolidation-browser-results",
});
