import { expect, test } from "@playwright/test";
import { calculatorApiKey } from "./calculator-api-fixture";

test.beforeEach(({ baseURL }) => expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname));

for (const path of ["/", "/projects"]) test(`project creation is requested explicitly and supports keyboard submission on ${path}`, async ({ page }) => {
  await calculatorApiKey(page);
  let writes = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/projects" && request.method() === "POST") writes++; });
  await page.goto(path);
  const trigger = page.getByRole("button", { name: "New Project", exact: true });
  await expect(trigger).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Project name", exact: true })).toHaveCount(0);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Create project", exact: true });
  const name = dialog.getByRole("textbox", { name: "Project name", exact: true });
  await expect(name).toBeFocused();
  await name.fill("   ");
  await expect(dialog.getByRole("button", { name: "Create project", exact: true })).toBeDisabled();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(writes).toBe(0);
  await trigger.click();
  const title = `Dialog project ${crypto.randomUUID()}`;
  await name.fill(`  ${title}  `);
  await name.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(trigger).toBeFocused();
  const projects = await (await page.request.get("/api/projects")).json();
  expect(projects.filter((project: { name: string }) => project.name === title)).toHaveLength(1);
  expect(writes).toBe(1);
});

test("a failed project creation retains the name and can retry inside the dialog", async ({ page }) => {
  await calculatorApiKey(page);
  let attempts = 0;
  await page.route("**/api/projects", route => {
    if (route.request().method() === "POST" && ++attempts === 1)
      return route.fulfill({ status: 503, json: { error: "Project service temporarily unavailable." } });
    return route.continue();
  });
  await page.goto("/projects");
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create project", exact: true });
  const input = dialog.getByLabel("Project name", { exact: true });
  await input.fill("Retry this project");
  await input.press("Enter");
  await expect(dialog.getByRole("alert")).toHaveText("Project service temporarily unavailable.");
  await expect(input).toHaveValue("Retry this project");
  expect(await (await page.request.get("/api/projects")).json()).toEqual([]);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Retry this project", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test("a pending create cannot be submitted twice or dismissed before its result", async ({ page }) => {
  await calculatorApiKey(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  await page.route("**/api/projects", async route => {
    if (route.request().method() === "POST") { writes++; await held; }
    await route.continue();
  });
  await page.goto("/projects");
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create project", exact: true });
  await dialog.getByLabel("Project name", { exact: true }).fill("One pending project");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await dialog.locator("form").dispatchEvent("submit");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(writes).toBe(1);
  release();
  await expect(dialog).toHaveCount(0);
  expect((await (await page.request.get("/api/projects")).json()).filter((project: { name: string }) => project.name === "One pending project")).toHaveLength(1);
});

test("local carts use the same dialog without account writes or calculator shortcuts escaping it", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url()); });
  await page.goto("/");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Cart name", exact: true })).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "New Cart", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Create cart", exact: true });
  const input = dialog.getByLabel("Cart name", { exact: true });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Cart 2");
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Alt+a");
  await page.keyboard.press("Alt+1");
  await expect(page.getByRole("dialog", { name: "Choose service", exact: true })).toHaveCount(0);
  await expect(input).toBeFocused();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("neoCalculator.localCarts.v1")!));
  expect(before.carts).toHaveLength(1);
  expect(before.carts[0].products).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await input.fill("  New local quotation  ");
  await input.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select local cart New local quotation", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(writes).toEqual([]);
});

test("local storage failures retain the creation dialog and existing carts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Cart", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create cart", exact: true });
  await dialog.getByLabel("Cart name", { exact: true }).fill("Retained draft");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "neoCalculator.localCarts.v1") throw new DOMException("Full", "QuotaExceededError");
      original.call(this, key, value);
    };
    window.addEventListener("restore-cart-storage", () => { Storage.prototype.setItem = original; }, { once: true });
  });
  await dialog.getByRole("button", { name: "Create cart", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Unable to save carts in this browser");
  await expect(dialog.getByLabel("Cart name", { exact: true })).toHaveValue("Retained draft");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("neoCalculator.localCarts.v1")!).carts.length)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("restore-cart-storage")));
  await dialog.getByRole("button", { name: "Create cart", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select local cart Retained draft", exact: true })).toBeVisible();
});

for (const width of [280, 375, 1440]) test(`cart filters stay usable and inside the panel at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 });
  await page.goto("/");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Open cart filters", exact: true });
  await trigger.click();
  const filters = page.getByRole("region", { name: "Cart filters", exact: true });
  await expect(filters).toBeVisible();
  const bounds = (await filters.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 8);
  await filters.getByRole("combobox", { name: "Sort cart items", exact: true }).click();
  await page.getByRole("option", { name: "Price high to low", exact: true }).click();
  await expect(filters).toBeVisible();
  await expect(filters.getByRole("combobox", { name: "Sort cart items", exact: true })).toContainText("Price high to low");
  await filters.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(filters.getByRole("combobox", { name: "Sort cart items", exact: true })).toContainText("Saved order");
  await page.keyboard.press("Escape");
  await expect(filters).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "New Cart", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create cart", exact: true });
  const popup = (await dialog.boundingBox())!;
  expect(popup.x).toBeGreaterThanOrEqual(8);
  expect(popup.x + popup.width).toBeLessThanOrEqual(width - 8);
  await page.screenshot({ path: `/tmp/neo-creation-dialog-${width}.png`, fullPage: false });
  await page.keyboard.press("Escape");
});
