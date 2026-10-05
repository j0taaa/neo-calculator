import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "responsive.playwright.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 2,
  use: {
    baseURL: process.env.NEO_TEST_URL ?? "http://127.0.0.1:3307",
    browserName: process.env.NEO_TEST_BROWSER === "webkit" ? "webkit" : "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  outputDir: "/tmp/neo-responsive-results",
});
