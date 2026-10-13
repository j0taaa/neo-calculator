import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "calculator-deployment.playwright.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: { headless: true, trace: "retain-on-failure" },
  outputDir: "/tmp/neo-calculator-deployment-results",
});
