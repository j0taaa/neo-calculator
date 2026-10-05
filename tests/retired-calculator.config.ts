import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "retired-calculator.playwright.ts", workers: 1,
  timeout: 240000, expect: { timeout: 30000 },
  use: { baseURL: process.env.NEO_TEST_URL ?? "http://127.0.0.1:3319", headless: true, trace: "retain-on-failure" },
  outputDir: "/tmp/neo-retire-browser-results",
});
