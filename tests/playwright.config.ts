import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "architecture-smoke.playwright.ts",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  use: { baseURL: process.env.NEO_TEST_URL ?? "http://127.0.0.1:3307", headless: true, trace: "retain-on-failure" },
  outputDir: "/tmp/neo-architecture-playwright-results",
});
