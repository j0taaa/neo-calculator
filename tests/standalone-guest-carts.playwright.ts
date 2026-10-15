import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { calculatorApiKey } from "./calculator-api-fixture";
import type { ProductMutationBody } from "../lib/calculator-types";

const key = "neoCalculator.localCarts.v1";
type Workspace = { selectedId: string; carts: { id: string; name: string; products: (ProductMutationBody & { id: string })[] }[] };
const workspace = (page: Page): Promise<Workspace> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
const selected = async (page: Page) => { const saved = await workspace(page); return saved.carts.find(cart => cart.id === saved.selectedId)!; };
async function importFile(page: Page, document: unknown, kind: "Cart" | "Project" = "Cart") {
  await page.getByRole("button", { name: "Open local cart actions", exact: true }).click();
  await page.getByRole("menuitem", { name: `Import ${kind}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Import ${kind} JSON`, exact: true });
  await expect(dialog.getByRole("button", { name: "Copy JSON schema", exact: true })).toBeEnabled();
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Choose JSON file", exact: true }).click();
  await (await chooser).setFiles({ name: "generated-cart.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(document)) });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: /^Imported \d+ local cart/ })).toBeVisible();
}
const intentCart = (name: string) => ({ schemaVersion: 2, resourceType: "cart", cart: { name, products: [{ serviceCode: "HUAWEI:ecs", region: "ap-southeast-1", billingMode: "ONDEMAND", title: "Guest ECS", choices: [{ field: "global_ONDEMANDTIME:0", value: 37 }, { field: "global_QUANTITY:0", value: 2 }] }] } });

test.beforeEach(async ({ page, baseURL }) => {
  expect(["127.0.0.1", "localhost"]).toContain(new URL(baseURL!).hostname);
  await page.route("**/*", route => /^https?:/.test(route.request().url()) && new URL(route.request().url()).origin !== new URL(baseURL!).origin ? route.abort() : route.continue());
});

test("anonymous ECS saves and edits locally, survives reload, and exports account-compatible JSON", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" && request.method() !== "HEAD") writes.push(request.url()); });
  await page.goto("/?service=ECS&region=cn-hong-kong");
  await expect(page.getByRole("button", { name: "New Cart", exact: true })).toBeEnabled();
  const quote = page.getByTestId("lab-price");
  await expect(quote).toBeVisible();
  await page.getByLabel("Resource name", { exact: true }).fill("Anonymous server");
  await page.locator('[data-field-id="global_ONDEMANDTIME:0"]').fill("12");
  const amount = Number((await quote.innerText()).replace(/[^\d.]/g, ""));
  await page.locator("[data-calculator-add-button]").click();
  await expect.poll(async () => (await selected(page)).products.length).toBe(1);
  let product = (await selected(page)).products[0];
  expect((product.pricing as { amount: number }).amount).toBeCloseTo(amount, 6);
  const id = product.id;
  await page.getByRole("button", { name: "Edit Anonymous server", exact: true }).click();
  await page.locator('[data-field-id="global_ONDEMANDTIME:0"]').fill("24");
  await page.locator("[data-calculator-add-button]").click();
  await expect.poll(async () => ((await selected(page)).products[0].pricing as { amount: number }).amount).toBeCloseTo(amount * 2, 6);
  expect((await selected(page)).products[0].id).toBe(id);
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Cart", exact: true }).getByText("Anonymous server", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Open actions for My Cart", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export Cart JSON", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export Cart JSON", exact: true });
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download JSON", exact: true }).click();
  const download = await downloading;
  const document = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(document.resourceType).toBe("cart"); expect(document).not.toHaveProperty("project");
  expect(document.cart.products[0]).not.toHaveProperty("id");
  const validated = await page.request.post("/api/v1/cart/validate", { data: document });
  expect(validated.ok(), await validated.text()).toBe(true);
  expect((await validated.json()).normalized.cart.products[0].pricing.amount).toBeCloseTo(amount * 2, 6);
  await calculatorApiKey(page);
  const parent = await (await page.request.post("/api/projects", { data: { name: "Guest JSON interop" } })).json();
  const imported = await page.request.post("/api/import", { data: { payload: document, targetProjectId: parent.id } });
  expect(imported.status(), await imported.text()).toBe(201);
  const data = await imported.json();
  product = (await (await page.request.get(`/api/lists/${data.listId}/products`)).json())[0];
  expect((product.pricing as { amount: number }).amount).toBeCloseTo(amount * 2, 6);
});

test("guest project import creates independent carts and client repricing matches all billing modes", async ({ page }) => {
  const configurations = [
    ["ecs", "ONDEMAND"], ["ecs", "PERIOD"], ["ecs", "RI"], ["hcss", "PERIOD"], ["elb", "ONDEMAND"], ["obs", "ONDEMAND"], ["ccm", "ONETIME"],
  ];
  const document = { schemaVersion: 2, resourceType: "project", project: { name: "Not a guest project", lists: [
    { name: "Guest modes", products: configurations.map(([service, billingMode]) => ({ serviceCode: `HUAWEI:${service}`, region: "ap-southeast-1", billingMode, choices: [] })) },
    { name: "Separate cart", products: [] },
  ] } };
  const verified = await page.request.post("/api/v1/cart/validate", { data: document });
  expect(verified.ok(), await verified.text()).toBe(true);
  const expected = (await verified.json()).normalized.project.lists[0].products;
  await page.goto("/"); await importFile(page, document, "Project");
  const imported = (await selected(page)).products;
  expect(imported).toHaveLength(configurations.length);
  imported.forEach((product, index) => expect(product.pricing).toEqual(expected[index].pricing));
  expect(await page.getByText("Not a guest project", { exact: true }).count()).toBe(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "New Cart", exact: true })).toBeEnabled();
  const after = (await selected(page)).products;
  after.forEach((product, index) => expect(product.pricing).toEqual(expected[index].pricing));
  expect((await workspace(page)).carts.map(cart => cart.name)).toEqual(["My Cart", "Guest modes", "Separate cart"]);
});

test("share links open editable local copies, preserve recipient carts and also work when signed in", async ({ page, browser, baseURL }) => {
  await page.goto("/"); await importFile(page, intentCart("São Paulo 日本語 🚀"));
  const original = await selected(page);
  await page.getByRole("button", { name: `Open local actions for ${original.name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Share Cart", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share Cart", exact: true });
  const link = await dialog.getByLabel("Cart share link", { exact: true }).inputValue();
  expect(new URL(link).pathname).toBe("/cart"); expect(new URL(link).hash).toMatch(/^#cart=v1\./);
  const context = await browser.newContext({ baseURL });
  const recipient = await context.newPage();
  await recipient.goto("/");
  await recipient.getByRole("button", { name: "New Cart", exact: true }).click();
  await recipient.getByRole("dialog", { name: "Create cart", exact: true }).getByLabel("Cart name", { exact: true }).fill("Recipient cart");
  await recipient.getByRole("button", { name: "Create cart", exact: true }).click();
  await calculatorApiKey(recipient); // An authenticated recipient still opens the standalone workspace.
  await recipient.goto(link);
  await expect(recipient.getByText("Shared cart opened as a local copy. Your changes stay in this browser.", { exact: true })).toBeVisible();
  const copied = await selected(recipient);
  expect(copied.name).toBe(original.name); expect(copied.id).not.toBe(original.id);
  expect(copied.products[0].id).not.toBe(original.products[0].id); expect(copied.products[0].pricing).toEqual(original.products[0].pricing);
  expect((await workspace(recipient)).carts.some(cart => cart.name === "Recipient cart")).toBe(true);
  expect(await recipient.getByText("My Projects", { exact: true }).count()).toBe(0);
  await recipient.getByRole("button", { name: "Edit Guest ECS", exact: true }).click();
  await recipient.locator('[data-field-id="global_ONDEMANDTIME:0"]').fill("74");
  await recipient.locator("[data-calculator-add-button]").click();
  await expect.poll(async () => ((await selected(recipient)).products[0].pricing as { amount: number }).amount).toBeCloseTo((original.products[0].pricing as { amount: number }).amount * 2, 6);
  expect((await selected(page)).products[0].pricing).toEqual(original.products[0].pricing);
  await recipient.reload(); await expect(recipient.getByRole("complementary", { name: "Cart", exact: true }).getByText("Guest ECS", { exact: true })).toBeVisible();
  expect((await workspace(recipient)).carts.filter(cart => cart.name === original.name)).toHaveLength(1);
  await context.close();
});

test("invalid imports and share links reject atomically, while corrupt storage offers recovery", async ({ page }) => {
  await page.goto("/"); await importFile(page, intentCart("Original cart"));
  const before = await workspace(page);
  await page.goto("/cart#cart=v1.bad");
  await expect(page.getByRole("alert").filter({ hasText: "Invalid or oversized cart share link" })).toBeVisible();
  expect(await workspace(page)).toEqual(before);
  await page.getByRole("button", { name: "Open local cart actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Import Project", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose JSON file", exact: true }).click();
  const invalid = { schemaVersion: 2, resourceType: "project", project: { name: "Bad", lists: [intentCart("Good").cart, { name: "Bad", products: [{ serviceCode: "HUAWEI:missing", region: "ap-southeast-1", billingMode: "ONDEMAND", choices: [] }] }] } };
  await (await chooser).setFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole("alert").filter({ hasText: "Unknown published service" })).toBeVisible();
  expect(await workspace(page)).toEqual(before);
  await page.evaluate(key => localStorage.setItem(key, "broken-local-carts"), key);
  await page.reload();
  await expect(page.getByRole("button", { name: "Download stored data", exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe("broken-local-carts");
});

test("storage failures do not acknowledge a saved estimate or lose existing cart data", async ({ page }) => {
  await page.goto("/?service=ECS&region=cn-hong-kong");
  await expect(page.getByRole("button", { name: "New Cart", exact: true })).toBeEnabled();
  await expect(page.getByTestId("lab-price")).toBeVisible();
  const before = await workspace(page);
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException("Full", "QuotaExceededError"); original.call(this, name, value); };
  }, key);
  await page.locator("[data-calculator-add-button]").click();
  await expect(page.getByText("Unable to save carts in this browser. Check browser storage permissions or export your cart.", { exact: true })).toBeVisible();
  expect(await workspace(page)).toEqual(before);
});

test("queued configurations, clipboard cut/paste and local cart management work without account writes", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const privateWrites: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" && !request.url().includes("/api/v1/cart/validate")) privateWrites.push(request.url()); });
  await page.goto("/?service=ECS&region=cn-hong-kong"); await expect(page.getByTestId("lab-price")).toBeVisible();
  for (const title of ["Queued one", "Queued two"]) {
    await page.getByLabel("Resource name", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Queue for batch", exact: true }).click();
  }
  await page.getByRole("tab", { name: /^Batch add/ }).click();
  await expect(page.getByText("Import existing ECS text batches", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save queued configurations", exact: true }).click();
  await expect.poll(async () => (await selected(page)).products.length).toBe(2);
  const cart = page.getByRole("complementary", { name: "Cart", exact: true });
  await cart.getByRole("button", { name: /Queued one.*Qty/ }).first().click();
  await page.keyboard.press("Control+x");
  await expect.poll(async () => (await selected(page)).products.length).toBe(1);
  await page.keyboard.press("Control+v");
  await expect.poll(async () => (await selected(page)).products.length).toBe(2);
  await page.getByRole("button", { name: "Open local actions for My Cart", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename Cart", exact: true }).click();
  await page.getByRole("textbox", { name: "Local cart name", exact: true }).fill("Renamed cart");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page.getByRole("button", { name: "Open local actions for Renamed cart", exact: true }).click();
  await page.getByRole("menuitem", { name: "Duplicate Cart", exact: true }).click();
  const copied = await selected(page); expect(copied.name).toBe("Renamed cart copy");
  await page.getByRole("button", { name: "Delete Queued one", exact: true }).click();
  await expect.poll(async () => (await selected(page)).products.length).toBe(1);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: `Open local actions for ${copied.name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete Cart", exact: true }).click();
  expect((await workspace(page)).carts).toHaveLength(1);
  expect((await selected(page)).products).toHaveLength(2);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Open local actions for Renamed cart", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete Cart", exact: true }).click();
  await page.getByRole("tab", { name: "Calculator", exact: true }).click();
  await expect(page.locator("p:visible").filter({ hasText: /^Create or select a cart to save\.$/ })).toBeVisible();
  expect((await workspace(page)).carts).toHaveLength(0);
  await page.getByRole("button", { name: "New Cart", exact: true }).click();
  await page.getByRole("button", { name: "Create cart", exact: true }).click();
  await page.locator("[data-calculator-add-button]").click();
  await expect.poll(async () => (await selected(page)).products.length).toBe(1);
  expect(privateWrites).toEqual([]);
});

test("two tabs cannot overwrite each other's newer local carts", async ({ page, context }) => {
  await page.goto("/"); await expect(page.getByRole("button", { name: "New Cart", exact: true })).toBeEnabled();
  const second = await context.newPage();
  await second.goto("/"); await expect(second.getByRole("button", { name: "New Cart", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "New Cart", exact: true }).click();
  await page.getByRole("dialog", { name: "Create cart", exact: true }).getByLabel("Cart name", { exact: true }).fill("First tab cart");
  await page.getByRole("button", { name: "Create cart", exact: true }).click();
  await second.getByRole("button", { name: "New Cart", exact: true }).click();
  await second.getByRole("dialog", { name: "Create cart", exact: true }).getByLabel("Cart name", { exact: true }).fill("Second tab cart");
  await second.getByRole("button", { name: "Create cart", exact: true }).click();
  await expect(second.getByRole("dialog", { name: "Create cart", exact: true }).getByRole("alert")).toContainText("Local carts changed in another tab");
  expect((await workspace(page)).carts.map(cart => cart.name)).toEqual(["My Cart", "First tab cart"]);
  await second.reload();
  await expect(second.getByRole("button", { name: "Select local cart First tab cart", exact: true })).toBeVisible();
});
