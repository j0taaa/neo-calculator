import { expect, test } from "@playwright/test";
import type { NativeState } from "../lib/huawei-native/native-types";

// Read-only production checks: anonymous renderer sessions, no accounts or cart mutations.
test("public navigation and old bookmarks reach the single live workspace", async ({ page, request }) => {
  const response = await request.get("/synchronized?edit=old-item", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/?tab=huawei-live&editProduct=old-item");
  await page.goto("/synchronized");
  await expect(page.getByRole("tab")).toHaveText(["Calculator", "Batch add"]);
  await expect(page.getByLabel("Service", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Elastic Cloud Server", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Synced calculator", exact: true })).toHaveCount(0);
  expect((await request.get("/api/huawei-sync")).status()).toBe(404);
  expect((await request.get("/api/sync-lab")).status()).toBe(404);
});

for (const [service, billingMode] of [["nat", "ONDEMAND"], ["elb", "PERIOD"], ["ecs", "RI"], ["ccm", "ONETIME"]] as const) {
  test(`deployed ${service}/${billingMode} returns current options and a complete Huawei price`, async ({ page }) => {
    await page.goto("/?tab=huawei-live");
    await page.getByLabel("Service", { exact: true }).selectOption(({ nat: "NAT", elb: "ELB", ecs: "ECS", ccm: "CCM" } as const)[service]);
    await page.getByLabel("Huawei region", { exact: true }).selectOption("ap-southeast-1");
    await page.getByLabel("Huawei billing mode", { exact: true }).selectOption(billingMode);
    const opened = page.waitForResponse(r => r.url().endsWith("/api/calculator/native") &&
      r.request().method() === "POST" && r.request().postDataJSON()?.action === "open");
    await page.getByRole("button", { name: "Open calculator", exact: true }).click();
    const response = await opened;
    expect(response.status()).toBe(200);
    const state: NativeState = await response.json();
    try {
      expect(state.service).toBe(service);
      expect(state.region).toBe("ap-southeast-1");
      expect(state.billingMode).toBe(billingMode);
      expect(state.diagnostics).toEqual([]);
      expect(state.quote).not.toBeNull();
      await expect(page.getByTestId("lab-price")).toBeVisible();
      expect(Number((await page.getByTestId("lab-price").innerText()).replace(/USD|,/g, "").trim()))
        .toBe(state.quote!.amount);
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await page.request.post("/api/calculator/native", { data: { action: "close", session: state.session } });
    }
  });
}
