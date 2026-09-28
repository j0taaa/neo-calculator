import { expect, test } from "@playwright/test";
import { getMonthlyPrice } from "../lib/resource-export";

test("published source versions drive conditional fields and live pricing", async ({ page }) => {
  await page.goto("/synchronized");
  await page.getByLabel("Service", { exact: true }).selectOption("nat");
  await page.getByLabel("Region", { exact: true }).selectOption("ap-southeast-1");
  await expect(page.getByText("Duration (days)", { exact: true })).toBeVisible();
  await page.getByLabel("Gateway", { exact: true }).selectOption({ label: "Private network" });
  await expect(page.getByText("Duration (hours)", { exact: true })).toBeVisible();
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "Large" });
  await page.getByRole("button", { name: "Get current price" }).click();
  await expect(page.getByTestId("synced-price")).toHaveText(/^USD \d+\.\d{2}$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("server rejects stale release IDs, invalid duration and unauthenticated saves", async ({ request }) => {
  const response = await request.post("/api/huawei-sync/nat", { data: { action: "form", region: "ap-southeast-1", values: {} } });
  expect(response.ok()).toBe(true);
  const data = await response.json();
  const input = { region: "ap-southeast-1", values: data.form.values, releaseId: data.releaseId };
  const stale = await request.post("/api/huawei-sync/nat", { data: { ...input, action: "quote", releaseId: "old-version" } });
  expect(stale.status()).toBe(422);
  expect((await stale.json()).error).toContain("updated");
  expect((await request.post("/api/huawei-sync/nat", { data: { ...input, action: "quote", duration: -1 } })).status()).toBe(422);
  expect((await request.post("/api/huawei-sync/nat", { data: { ...input, action: "save", listId: "unauthorized" } })).status()).toBe(403);
});

test("synchronized estimates save, reopen, edit, clone, share and export through existing carts", async ({ page, baseURL }) => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Synchronization Test", email: `sync-${crypto.randomUUID()}@example.test`, password: "Sync-test-password-2026" } });
  expect(signup.ok()).toBe(true);
  const project = await (await page.request.post("/api/projects", { data: { name: "Sync regression" } })).json();
  const list = await (await page.request.post(`/api/projects/${project.id}/lists`, { data: { name: "Synced cart" } })).json();
  await page.goto("/synchronized");
  await page.getByLabel("Service", { exact: true }).selectOption("nat");
  await page.getByLabel("Region", { exact: true }).selectOption("ap-southeast-1");
  await page.getByLabel("Cart", { exact: true }).selectOption(list.id);
  await page.getByRole("button", { name: "Save to cart", exact: true }).click();
  await expect(page.getByText("Saved to your cart", { exact: false })).toBeVisible();
  let products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products).toHaveLength(1);
  const saved = products[0];
  expect(saved.pricing.source).toBe("huawei-inquiry");
  expect(saved.config.huaweiSync.releaseId).toBe(saved.pricing.releaseId);
  expect(saved.pricing.suffix).toBe("/24h");
  expect(getMonthlyPrice(saved.pricing)).toBeCloseTo(saved.pricing.amount * 744 / 24, 5);
  await page.goto(`/synchronized?service=nat&edit=${saved.id}`);
  await expect(page.getByLabel("Gateway", { exact: true })).toHaveValue("dataInfo_5_");
  await page.getByLabel("Duration", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Saved to your cart", { exact: false })).toBeVisible();
  products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products).toHaveLength(1);
  expect(products[0].id).toBe(saved.id);
  expect(products[0].config.huaweiSync.input.duration).toBe(3);
  expect(products[0].pricing.amount).toBeCloseTo(saved.pricing.amount * 3, 5);
  const cloneResponse = await page.request.post(`/api/lists/${list.id}/clone`, { data: { name: "Sync clone" } });
  expect(cloneResponse.ok()).toBe(true);
  const cloned = await cloneResponse.json();
  expect(cloned.products[0].id).not.toBe(saved.id);
  expect(cloned.products[0].config).toEqual(products[0].config);
  const keyResponse = await page.request.post("/api/api-keys");
  expect(keyResponse.status()).toBe(201);
  const { key } = await keyResponse.json();
  const apiProduct = await page.request.post(`/api/v1/private/lists/${cloned.id}/products`, {
    headers: { "X-API-Key": key },
    data: { serviceCode: "HWC:nat", serviceName: "NAT Gateway", config: products[0].config },
  });
  expect(apiProduct.status()).toBe(201);
  expect((await apiProduct.json()).pricing.amount).toBe(products[0].pricing.amount);
  const share = await (await page.request.post("/api/share", { data: { resourceType: "list", resourceId: list.id, mode: "copy" } })).json();
  expect((await page.request.get(`/api/share/${share.id}`)).ok()).toBe(true);
  await page.goto(`/?project=${project.id}&list=${list.id}`);
  const cart = page.getByRole("button", { name: /^Synced cart/ });
  if (!(await cart.isVisible())) {
    const expand = page.getByRole("button", { name: "Expand project", exact: true });
    if (await expand.isVisible()) await expand.click();
  }
  await cart.click();
  await page.getByRole("button", { name: "Open actions for Synced cart" }).click();
  await page.getByRole("menuitem", { name: "Export Cart JSON", exact: true }).click();
  const exported = JSON.parse(await page.getByRole("textbox", { name: "Resource export JSON" }).inputValue());
  const imported = await page.request.post("/api/import", { data: { payload: exported, targetProjectId: project.id } });
  expect(imported.status()).toBe(201);
  expect((await imported.json()).importedProductCount).toBe(1);
});
