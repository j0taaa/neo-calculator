import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getServiceBundle } from "../config/services/bundles";
import expected from "./fixtures/runtime/expected.json";

const services = ["DCS", "NAT", "EVS", "DMS", "ELB", "VPN", "RDS", "EIP"];

async function useCatalogFixtures(page: Page) {
  // Avoid starting the unrelated ECS catalog synchronizer during these UI scenarios.
  await page.route("**/api/catalog/ecs-flavors?*", (route) => route.fulfill({ json: { flavors: [], diskPricing: null } }));
  for (const code of services) {
    const source = getServiceBundle(code)!.runtime!.catalog!;
    const catalog = JSON.parse(await readFile(resolve(`tests/fixtures/runtime/${code.toLowerCase()}.json`), "utf8"));
    await page.route(`**/api/catalog/${source.route}?*`, (route) => route.fulfill({
      json: { region: "la-sao-paulo1", catalogRegionId: "sa-brazil-1", [source.catalogPath ?? "catalog"]: catalog },
    }));
  }
}

async function selectService(page: Page, code: string) {
  await page.getByRole("button", { name: "Open service search" }).click();
  const search = page.getByPlaceholder("Search service name");
  await search.fill(code);
  await page.getByRole("option").filter({ hasText: getServiceBundle(code)!.service.serviceName }).first().click();
}

for (const code of services) {
  test(`${code} calculator renders its catalog and estimate`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await useCatalogFixtures(page);
    await page.goto("/");
    const catalogLoaded = page.waitForResponse((response) => response.url().includes(`/api/catalog/${getServiceBundle(code)!.runtime!.catalog!.route}?`));
    await selectService(page, code);
    await catalogLoaded;
    if (code === "VPN") {
      // Select a concrete billing/edition combination after catalog normalization.
      await page.getByRole("button", { name: "Pay-per-use", exact: true }).click();
      await page.getByRole("button", { name: "Classic", exact: true }).click();
    }
    await expect(page.getByText(`Loading ${code} pricing...`, { exact: true })).toBeHidden();
    const product = expected.find((fixture) => fixture.code === code && fixture.name === "default")?.product;
    const savedTotal = (Array.isArray(product) ? product[0] : product)?.pricing?.total;
    expect(savedTotal).toBeTruthy();
    await expect(page.getByRole("tabpanel", { name: "Price Calculator" })).toContainText(savedTotal!.split("/")[0]);
    await expect(page.getByText(/Failed to load|pricing is unavailable/).first()).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("catalog routes preserve public URLs and response keys", async ({ request }) => {
  for (const name of ["nat-pricing", "evs-pricing", "dms-pricing"]) {
    const response = await request.get(`/api/catalog/${name}?region=cn-hong-kong`, { timeout: 60_000 });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body[name === "evs-pricing" ? "diskPricing" : "catalog"]).toBeTruthy();
    expect(body.catalogRegionId).toBe("ap-southeast-1");
  }
  expect((await request.get("/api/catalog/not-a-service")).status()).toBe(404);
  expect((await request.get("/api/projects")).status()).toBe(401);
  expect((await request.get("/api/v1/public/services")).status()).toBe(200);
});

test("saved estimates can be edited, batch-added, cloned, shared, exported and imported", async ({ page, baseURL }) => {
  // This scenario writes temporary accounts and must target an isolated local database.
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  await useCatalogFixtures(page);
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: { name: "Architecture Test", email: `architecture-${crypto.randomUUID()}@example.test`, password: "Architecture-test-password-2026" },
  });
  expect(signup.ok()).toBe(true);
  const projectResponse = await page.request.post("/api/projects", { data: { name: "Architecture regression" } });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json();
  const listResponse = await page.request.post(`/api/projects/${project.id}/lists`, { data: { name: "Regression cart" } });
  expect(listResponse.status()).toBe(201);
  const list = await listResponse.json();
  await page.goto(`/?project=${project.id}&list=${list.id}`);
  await selectService(page, "EVS");
  const add = page.getByRole("button", { name: "Add to List", exact: true });
  await expect(add).toBeEnabled();
  const savedResponse = page.waitForResponse((response) => response.url().includes(`/api/lists/${list.id}/products`) && response.request().method() === "POST");
  await add.click();
  expect((await savedResponse).status()).toBe(201);
  let products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products).toHaveLength(1);
  const original = products[0];
  await page.getByRole("button", { name: `Edit ${original.title}`, exact: true }).click();
  const editResponse = page.waitForResponse((response) => response.url().includes(`/products/${original.id}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Save Changes", exact: true }).first().click();
  expect((await editResponse).ok()).toBe(true);
  products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products[0].pricing).toEqual(original.pricing);
  expect(products[0].config).toEqual(original.config);

  await page.getByRole("tab", { name: "Batch add", exact: true }).click();
  await page.locator("textarea").fill(JSON.stringify([{ diskSizeGiB: 80, quantity: 2 }, { diskSizeGiB: 120, quantity: 1 }]));
  await page.getByRole("button", { name: "Add Batch", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(3);
  products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
  expect(products.map((product: { config: { diskSizeGiB: number } }) => product.config.diskSizeGiB).sort((a: number, b: number) => a - b)).toEqual([original.config.diskSizeGiB, 80, 120]);

  const clone = await page.request.post(`/api/lists/${list.id}/clone`, { data: { name: "Cloned regression cart" } });
  expect(clone.ok()).toBe(true);
  const cloned = await clone.json();
  expect(cloned.products).toHaveLength(3);
  expect(cloned.products.every((copy: { id: string }) => products.every((source: { id: string }) => source.id !== copy.id))).toBe(true);
  const keyResponse = await page.request.post("/api/api-keys");
  expect(keyResponse.status()).toBe(201);
  const { key } = await keyResponse.json();
  const apiClone = await page.request.post(`/api/v1/private/lists/${list.id}/clone`, {
    headers: { "X-API-Key": key }, data: { name: "API cloned regression cart" },
  });
  expect(apiClone.ok()).toBe(true);
  const apiCloned = await apiClone.json();
  expect(apiCloned.products).toHaveLength(3);
  const apiProduct = await page.request.post(`/api/v1/private/lists/${apiCloned.id}/products`, {
    headers: { "X-API-Key": key },
    data: { serviceCode: "DMS", serviceName: "DMS Kafka", config: { ...getServiceBundle("DMS")!.service.defaults, region: "la-sao-paulo1" } },
  });
  expect(apiProduct.status()).toBe(201);
  expect((await apiProduct.json()).pricing.total).toMatch(/^USD /);
  const share = await page.request.post("/api/share", { data: { resourceType: "list", resourceId: list.id, mode: "copy" } });
  expect(share.ok()).toBe(true);
  const shared = await share.json();
  expect((await page.request.get(`/api/share/${shared.id}`)).ok()).toBe(true);
  await page.goto(shared.shareUrl);
  await expect(page.getByText("Regression cart", { exact: true }).first()).toBeVisible();

  await page.goto(`/?project=${project.id}&list=${list.id}`);
  const originalCart = page.getByRole("button", { name: /^Regression cart/ });
  if (!(await originalCart.isVisible())) {
    const expand = page.getByRole("button", { name: "Expand project", exact: true });
    if (await expand.isVisible()) await expand.click();
  }
  await originalCart.click();
  await page.getByRole("button", { name: "Open actions for Regression cart" }).click();
  await page.getByRole("menuitem", { name: "Export Cart JSON", exact: true }).click();
  const exported = JSON.parse(await page.getByRole("textbox", { name: "Resource export JSON" }).inputValue());
  const imported = await page.request.post("/api/import", { data: { payload: exported, targetProjectId: project.id } });
  expect(imported.status()).toBe(201);
  expect((await imported.json()).importedProductCount).toBe(3);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});
