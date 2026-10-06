import { expect, test, type Page } from "@playwright/test";

const original = {
  serviceCode: "HWC:nat", serviceName: "NAT Gateway", productType: "huawei-synchronized",
  title: "Original NAT estimate", quantity: 1,
  config: { region: "ap-southeast-1", billingMode: "Pay-per-use", huaweiSync: {
    service: "nat", releaseId: "archived-release", input: {
      region: "ap-southeast-1", duration: 3, values: { "calculator_gateway.type": "archived-value" },
    },
  } },
  pricing: { amount: 123.45, currency: "USD", source: "huawei-inquiry", suffix: "/72h" },
};
async function importedCart(page: Page, baseURL?: string) {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  await page.route("**/api/catalog/ecs-flavors?*", route => route.fulfill({ json: { flavors: [], diskPricing: null } }));
  const signup = await page.request.post("/api/auth/sign-up/email", { data: {
    name: "Retirement regression", email: `retired-${crypto.randomUUID()}@example.test`, password: "Regression-password-2026",
  } });
  expect(signup.ok()).toBe(true);
  const imported = await page.request.post("/api/import", { data: {
    payload: { resourceType: "project", project: { name: "Old estimates", lists: [{ name: "Imported cart", products: [original] }] } },
  } });
  expect(imported.status()).toBe(201);
  const result = await imported.json();
  const projects = await (await page.request.get("/api/projects")).json();
  const project = projects.find((p: { id: string }) => p.id === result.projectId);
  const list = project.lists[0];
  expect(list.products[0].config).toEqual(original.config);
  return { project, list, product: list.products[0] };
}

test("retired pages redirect and retired form/quote endpoints are gone", async ({ page, request }) => {
  await page.route("**/api/catalog/ecs-flavors?*", route => route.fulfill({ json: { flavors: [], diskPricing: null } }));
  await page.goto("/synchronized");
  await expect(page.getByRole("heading", { name: "Elastic Cloud Server", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.getByRole("link", { name: "Synced calculator", exact: true })).toHaveCount(0);
  for (const path of ["/api/huawei-sync", "/api/huawei-sync/nat", "/api/sync-lab"])
    expect((await request.get(path)).status()).toBe(404);
  expect((await request.post("/api/huawei-sync/nat", { data: { action: "save" } })).status()).toBe(404);
  await page.goto("/sync-lab/audit");
  await expect(page.getByRole("heading", { name: "Elastic Cloud Server", exact: true })).toBeVisible();
});

test("old imports remain readable, cloneable and shareable; cancellation and rejected repricing preserve them", async ({ page, baseURL }) => {
  const { list, product } = await importedCart(page, baseURL);
  await page.goto(`/synchronized?service=nat&edit=${encodeURIComponent(product.id)}`);
  await expect(page.getByText("Review the original estimate", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Service", { exact: true })).toHaveValue("NAT");
  await expect(page.getByLabel("Huawei region", { exact: true })).toHaveValue("ap-southeast-1");
  await expect(page.getByTestId("lab-price")).toHaveCount(0);
  await page.getByText("Original saved configuration", { exact: true }).click();
  await expect(page.locator("pre").filter({ hasText: "archived-value" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
  const stored = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(stored[0].config).toEqual(original.config);
  expect(stored[0].pricing).toEqual(original.pricing);
  const clone = await page.request.post(`/api/lists/${list.id}/clone`, { data: { name: "Preserved clone" } });
  expect(clone.status()).toBe(201);
  expect((await clone.json()).products[0].config).toEqual(original.config);
  const share = await page.request.post("/api/share", { data: { resourceType: "list", resourceId: list.id, mode: "copy" } });
  expect(share.ok()).toBe(true);
  expect((await page.request.get(`/api/share/${(await share.json()).id}`)).ok()).toBe(true);
  const key = (await (await page.request.post("/api/api-keys")).json()).key;
  const priced = await page.request.post(`/api/v1/private/lists/${list.id}/products`, {
    headers: { "X-API-Key": key }, data: original,
  });
  expect(priced.status()).toBe(422);
  expect((await priced.json()).error).toContain("Huawei live");
  const patch = await page.request.patch(`/api/lists/${list.id}/products/${product.id}`, { data: original });
  expect(patch.status()).toBe(422);
  expect((await (await page.request.get(`/api/lists/${list.id}/products`)).json())[0]).toEqual(stored[0]);
});

test("reselecting an imported estimate replaces the same item only after review and a verified fresh save", async ({ page, baseURL }) => {
  const { project, list, product } = await importedCart(page, baseURL);
  await page.goto(`/?project=${project.id}&list=${list.id}`);
  await page.getByRole("button", { name: `Edit ${product.title}`, exact: true }).click();
  await expect(page.getByText("Review the original estimate", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open calculator", exact: true }).click();
  await expect(page.getByTestId("lab-price")).toBeVisible({ timeout: 110000 });
  const save = page.getByRole("tabpanel", { name: "Calculator", exact: true }).getByRole("button", { name: "Save Changes", exact: true });
  await expect(save).toBeDisabled();
  const duration = page.locator('[data-field-id="global_ONDEMANDTIME:0"]');
  await duration.fill("3"); await duration.press("Tab");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  const price = Number((await page.getByTestId("lab-price").innerText()).replace(/USD|,/g, "").trim());
  await page.getByLabel("I reviewed these selections against the original estimate.", { exact: true }).check();
  const response = page.waitForResponse(r => r.url().endsWith(`/products/${product.id}`) && r.request().method() === "PATCH");
  await save.click();
  const saved = await response;
  expect(saved.status()).toBe(200);
  const converted = await saved.json();
  expect(converted.id).toBe(product.id);
  expect(converted.serviceCode).toBe("HUAWEI:nat");
  expect(converted.productType).toBe("huawei-native");
  expect(converted.config.selection.billingMode).toBe("ONDEMAND");
  expect(converted.config.selection.fields.find((f: { component: string }) => f.component === "global_ONDEMANDTIME").value).toBe(3);
  expect(converted.pricing.amount).toBe(price);
  expect(converted.config.session).toBeUndefined();
  await page.goto(`/synchronized?edit=${product.id}`);
  await expect(page.getByTestId("lab-price")).toBeVisible({ timeout: 110000 });
  await expect(page.getByText("Review the original estimate", { exact: true })).toHaveCount(0);
  await expect(duration).toHaveValue("3");
  await page.goto("/projects");
});
