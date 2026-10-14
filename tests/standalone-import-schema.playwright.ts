import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { calculatorApiKey } from "./calculator-api-fixture";

async function workspace(page: Page) {
  await calculatorApiKey(page);
  const project = await (await page.request.post("/api/projects", { data: { name: "Schema popup regression" } })).json();
  await page.goto(`/?project=${project.id}`);
  await expect(page.getByRole("button", { name: "Open actions for Schema popup regression", exact: true })).toBeVisible();
  return project;
}
async function open(page: Page, kind: "Cart" | "Project") {
  await page.getByRole("button", { name: kind === "Project" ? "Open project actions" : "Open actions for Schema popup regression", exact: true }).click();
  await page.getByRole("menuitem", { name: `Import ${kind}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Import ${kind} JSON`, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
test.beforeEach(async ({ baseURL }) => expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname));

test("cart and project import popups copy and download the current published schema", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await workspace(page);
  const current = await (await page.request.get("/api/v1/cart/schema")).json();
  for (const kind of ["Cart", "Project"] as const) {
    const dialog = await open(page, kind);
    await expect(dialog.getByRole("button", { name: "Choose JSON file", exact: true })).toBeFocused();
    const copy = dialog.getByRole("button", { name: "Copy JSON schema", exact: true });
    await expect(copy).toBeEnabled();
    await copy.click();
    await expect(dialog.getByText("JSON schema copied to clipboard.", { exact: true })).toBeVisible();
    expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual(current);
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download JSON schema", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("neocalculator-resource-schema.json");
    expect(JSON.parse(await readFile((await download.path())!, "utf8"))).toEqual(current);
    await dialog.getByText("Preview JSON schema", { exact: true }).click();
    expect(JSON.parse(await dialog.getByLabel("Current resource JSON schema").inputValue())).toEqual(current);
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("reopening or refreshing fetches newly published schemas and never reuses a stale copy", async ({ page }) => {
  await workspace(page);
  const schema = await (await page.request.get("/api/v1/cart/schema")).json();
  let calls = 0;
  await page.route("**/api/v1/cart/schema", route => {
    const fresh = structuredClone(schema);
    fresh["x-neo"].releaseId = String(++calls).padStart(64, "0");
    fresh["x-neo"].services.push({ serviceCode: `HUAWEI:new-service-${calls}`, name: "New published service", regions: [] });
    return route.fulfill({ json: fresh });
  });
  let dialog = await open(page, "Project");
  await dialog.getByText("Preview JSON schema", { exact: true }).click();
  const current = async () => JSON.parse(await dialog.getByLabel("Current resource JSON schema").inputValue());
  expect((await current())["x-neo"].releaseId).toBe("1".padStart(64,"0"));
  await dialog.getByRole("button", { name: "Refresh schema", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Copy JSON schema", exact: true })).toBeEnabled();
  await expect.poll(async () => (await current())["x-neo"].releaseId).toBe("2".padStart(64,"0"));
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  dialog = await open(page, "Project");
  await dialog.getByText("Preview JSON schema", { exact: true }).click();
  await expect.poll(async () => (await current())["x-neo"].releaseId).toBe("3".padStart(64,"0"));
  expect(calls).toBe(3);
});

test("schema failures retry without blocking file import and clipboard denial offers a download", async ({ page }) => {
  await workspace(page);
  const schema = await (await page.request.get("/api/v1/cart/schema")).json();
  let unavailable = true;
  await page.route("**/api/v1/cart/schema", route => unavailable ? route.fulfill({ status: 503, json: { error: "Published schema unavailable" } }) : route.fulfill({ json: schema }));
  const dialog = await open(page, "Cart");
  await expect(dialog.getByRole("alert")).toHaveText("Published schema unavailable");
  await expect(dialog.getByRole("button", { name: "Copy JSON schema", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Download JSON schema", exact: true })).toBeDisabled();
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: "Choose JSON file", exact: true }).click();
  await (await chooser).setFiles([]); // Cancelling the picker keeps the popup available.
  await expect(dialog).toBeVisible();
  unavailable = false;
  await dialog.getByRole("button", { name: "Retry schema", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Copy JSON schema", exact: true })).toBeEnabled();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) } }));
  await dialog.getByRole("button", { name: "Copy JSON schema", exact: true }).click();
  await expect(dialog.getByText("Clipboard access is unavailable. Download the schema instead.", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download JSON schema", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("neocalculator-resource-schema.json");
});

test("mobile schema popup stays inside the viewport and closes while its request is pending", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await workspace(page);
  await page.route("**/api/v1/cart/schema", route => route.abort("failed"));
  const dialog = await open(page, "Project");
  await expect(dialog.getByRole("alert")).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  await page.screenshot({ path: "/tmp/neo-import-schema-mobile.png" });
  await dialog.getByRole("button", { name: "Close Import Project JSON", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.unroute("**/api/v1/cart/schema");
  const schema = await (await page.request.get("/api/v1/cart/schema")).json();
  await page.route("**/api/v1/cart/schema", async route => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await route.fulfill({ json: schema }).catch(() => {}); // Closing aborts the pending fetch.
  });
  const pending = await open(page, "Project");
  await expect(pending.getByText("Loading the current JSON schema…", { exact: true })).toBeVisible();
  await expect(pending.getByRole("button", { name: "Copy JSON schema", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(pending).toHaveCount(0);
});

test("the Projects page shares the popup and imports cart/project files into the correct account", async ({ page }) => {
  const project = await workspace(page);
  const schema = await (await page.request.get("/api/v1/cart/schema")).json();
  const product = schema.examples[0].cart.products[0];
  const cart = { schemaVersion: 2, resourceType: "cart", cart: { name: "Projects page imported cart", products: [product] } };
  const projectFile = { schemaVersion: 2, resourceType: "project", project: { name: "Projects page imported project", lists: [cart.cart] } };
  await page.goto("/projects");
  for (const [kind, payload] of [["Cart", cart], ["Project", projectFile]] as const) {
    const dialog = await open(page, kind);
    await expect(dialog.getByRole("button", { name: "Copy JSON schema", exact: true })).toBeEnabled();
    const chooser = page.waitForEvent("filechooser");
    await dialog.getByRole("button", { name: "Choose JSON file", exact: true }).click();
    const imported = page.waitForResponse(response => response.url().endsWith("/api/import") && response.request().method() === "POST");
    await (await chooser).setFiles({ name: "resources.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload)) });
    const response = await imported;
    expect(response.status(), await response.text()).toBe(201);
    const result = await response.json();
    if (kind === "Cart") expect(result.projectId).toBe(project.id);
    else expect(result.importedProductCount).toBe(1);
    await expect(dialog).toHaveCount(0);
  }
});
