import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getServiceBundle } from "../config/services/bundles";
import { serviceCatalog } from "../lib/service-config";
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

async function createTestCart(page: Page, baseURL: string | undefined) {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
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
  return { project, list };
}

async function selectService(page: Page, code: string) {
  await page.getByRole("button", { name: "Open service search" }).click();
  const search = page.getByPlaceholder("Search service name");
  await search.fill(code);
  await page.getByRole("option").filter({ hasText: serviceCatalog.find((service) => service.code === code)!.name }).first().click();
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
  test.setTimeout(180_000);
  // This scenario writes temporary accounts and must target an isolated local database.
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  await useCatalogFixtures(page);
  const { project, list } = await createTestCart(page, baseURL);
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

for (const code of ["ECS", "Flexus L"]) {
  test(`${code} retains pricing through save, edit and batch add`, async ({ page, baseURL }) => {
    await useCatalogFixtures(page);
    if (code === "ECS") {
      const diskPricing = JSON.parse(await readFile(resolve("tests/fixtures/runtime/evs.json"), "utf8"));
      await page.route("**/api/catalog/ecs-flavors?*", (route) => route.fulfill({ json: {
        flavors: [{
          resourceSpecCode: "c7.large.4", family: "c7", architecture: "x86", series: "c", description: "Regression flavor",
          cpu: 2, ramGiB: 8, prices: { ONDEMAND: 0.1, MONTHLY: 50, RI: 400 }, currency: "USD", updatedAt: "2026-01-01",
        }], diskPricing,
      } }));
    }
    const { project, list } = await createTestCart(page, baseURL);
    await page.goto(`/?project=${project.id}&list=${list.id}`);
    await selectService(page, code);
    if (code === "ECS") {
      await page.getByRole("button", { name: "Pay-per-use", exact: true }).click();
      await expect(page.getByRole("button", { name: /c7.large.4/ }).first()).toBeVisible();
    } else {
      await page.getByRole("button", { name: /2 vCPUs \| 2 GiB/ }).click();
    }
    const savedResponse = page.waitForResponse((response) => response.url().endsWith(`/api/lists/${list.id}/products`) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Add to List", exact: true }).click();
    const response = await savedResponse;
    expect(response.status()).toBe(201);
    const original = await response.json();
    expect(original.pricing.total).toBe(code === "ECS" ? "USD 77.73/744h" : "USD 9.00/mo");
    await page.getByRole("button", { name: `Edit ${original.title}`, exact: true }).click();
    const editedResponse = page.waitForResponse((response) => response.url().endsWith(`/products/${original.id}`) && response.request().method() === "PATCH");
    await page.getByRole("button", { name: "Save Changes", exact: true }).first().click();
    const edited = await (await editedResponse).json();
    expect(edited.config).toEqual(original.config);
    expect(edited.pricing).toEqual(original.pricing);
    await page.getByRole("tab", { name: "Batch add", exact: true }).click();
    await page.locator("textarea").fill(JSON.stringify([code === "ECS"
      ? { vcpu: 2, ram: 8, quantity: 2 }
      : { vcpu: 2, ram: 2, quantity: 2 }]));
    await page.getByRole("button", { name: "Add Batch", exact: true }).click();
    await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(2);
    const products = await (await page.request.get(`/api/lists/${list.id}/products`)).json();
    const batchProduct = products.find((item: { id: string }) => item.id !== original.id);
    expect(batchProduct.quantity).toBe(2);
    expect(batchProduct.pricing.total).toBe(code === "ECS" ? "USD 155.47/744h" : "USD 18.00/mo");
  });
}

test("service shortcuts and dependent ECS disk controls survive the module split", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await useCatalogFixtures(page);
  const diskPricing = JSON.parse(await readFile(resolve("tests/fixtures/runtime/evs.json"), "utf8"));
  await page.route("**/api/catalog/ecs-flavors?*", (route) => route.fulfill({ json: {
    flavors: [{ resourceSpecCode: "c7.large.4", family: "c7", architecture: "x86", series: "c", description: "Test",
      cpu: 2, ramGiB: 8, prices: { ONDEMAND: 0.1, MONTHLY: 50 }, currency: "USD", updatedAt: "2026-01-01" }], diskPricing,
  } }));
  await page.goto("/?service=ECS&region=cn-hong-kong&billing=Pay-per-use&hours=730");
  await expect(page.getByRole("button", { name: /c7.large.4/ }).first()).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Price Calculator" })).toContainText("730h");
  await page.keyboard.press("Control+k");
  const search = page.getByPlaceholder("Search service name");
  await expect(search).toBeFocused();
  await search.fill("NAT");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toBeHidden();
  await expect(page.getByRole("tabpanel", { name: "Price Calculator" })).toContainText("Gateway");
  await selectService(page, "ECS");
  await page.getByRole("combobox").filter({ hasText: "High I/O" }).click();
  await page.getByRole("option", { name: "General Purpose SSD V2", exact: true }).click();
  const iops = page.locator("[data-calculator-focus-group]").filter({ has: page.getByText("IOPS", { exact: true }) }).locator("input");
  await expect(iops).toHaveValue("3000");
  await iops.fill("999999");
  await iops.blur();
  await expect(iops).toHaveValue("20000");
  await page.keyboard.press("Alt+3");
  await expect(page.getByRole("button", { name: "Pay-per-use", exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test("saved-item deep links, cart filtering, clipboard and project actions retain state", async ({ page, context, baseURL }) => {
  await useCatalogFixtures(page);
  const { project, list } = await createTestCart(page, baseURL);
  const productBody = { serviceCode: "EVS", serviceName: "Elastic Volume Service", productType: "evs", title: "Disk Alpha", quantity: 1,
    config: { region: "la-sao-paulo1", billingMode: "Pay-per-use", usageHours: 744, diskType: "High I/O", diskSizeGiB: 80, durationMonths: 1 }, pricing: { total: "USD 6.67/744h" } };
  const first = await (await page.request.post(`/api/lists/${list.id}/products`, { data: productBody })).json();
  await page.request.post(`/api/lists/${list.id}/products`, { data: { ...productBody, title: "Disk Beta" } });
  await page.request.post(`/api/projects/${project.id}/lists`, { data: { name: "Another cart" } });
  await page.goto(`/?service=EVS&project=${project.id}&list=${list.id}&editProduct=${first.id}&editList=${list.id}`);
  await expect(page.getByRole("button", { name: "Save Changes", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Architecture regression / Regression cart", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
  const filter = page.getByRole("textbox", { name: "Search cart items" });
  await filter.fill("Alpha");
  await expect(page.getByRole("button", { name: "Edit Disk Beta", exact: true })).toBeHidden();
  await filter.blur();
  await page.keyboard.press("Control+a");
  await expect(page.getByText("1 item selected", { exact: true })).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.keyboard.press("Control+c");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(clipboard).map((item: { title: string }) => item.title)).toEqual(["Disk Alpha"]);
  await page.keyboard.press("Escape");
  await expect(page.getByText("1 item selected", { exact: true })).toBeHidden();
  await filter.fill("");
  await filter.blur();
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text", text);
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, clipboard);
  await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(3);
  await page.getByRole("button", { name: "Open actions for Architecture regression", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename Project", exact: true }).click();
  await page.locator('input[value="Architecture regression"]').fill("Renamed project");
  await page.getByRole("button", { name: "Save project name", exact: true }).click();
  await expect(page.getByText("Renamed project / Regression cart", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Disk Beta", exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(`/api/lists/${list.id}/products`)).json()).length).toBe(2);
});
