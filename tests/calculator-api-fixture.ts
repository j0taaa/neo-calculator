import { expect, type Page } from "@playwright/test";

export async function calculatorApiKey(page: Page) {
  const signup = await page.request.post("/api/auth/sign-up/email", { data: {
    name: "Standalone API regression", email: `api-${crypto.randomUUID()}@example.test`, password: "Standalone-API-regression-2026",
  } });
  expect(signup.ok()).toBe(true);
  const key = await page.request.post("/api/api-keys");
  expect(key.ok()).toBe(true);
  return { "X-API-Key": (await key.json()).key as string };
}
