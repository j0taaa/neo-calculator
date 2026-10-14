import { test, expect, type Locator } from "@playwright/test";
import { calculatorApiKey } from "./calculator-api-fixture";

const expiredCookie = "Huawei session expired. Save a fresh Huawei Cloud cookie and try again.";

async function expectUnclipped(menu: Locator) {
  await expect(menu).toBeVisible();
  await expect.poll(async () => menu.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const item = element.querySelector('[role="menuitem"]')!;
    const itemRect = item.getBoundingClientRect();
    return {
      inViewport: rect.left >= 7 && rect.right <= innerWidth - 7 && rect.top >= 7 && rect.bottom <= innerHeight - 7,
      hitVisible: item.contains(document.elementFromPoint(itemRect.left + itemRect.width / 2, itemRect.top + itemRect.height / 2)),
    };
  })).toEqual({ inViewport: true, hitVisible: true });
  expect(await menu.evaluate(element => element.closest('[data-slot="card"]') === null)).toBe(true);
}

test.beforeEach(async ({ baseURL }) => expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname));

for (const width of [280, 375, 1440]) {
  test(`anonymous local cart menu stays visible at ${width}px without checking an old Huawei cookie`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => localStorage.setItem("neoCalculator.huaweiCookie", "old-demo-cookie"));
    let cartChecks = 0;
    await page.route("**/api/huawei/carts", route => {
      cartChecks++;
      return route.fulfill({ status: 401, json: { error: expiredCookie } });
    });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "ECS flavor browser" }).getByRole("button", { name: /^Select / }).first()).toBeVisible();
    const trigger = page.getByRole("button", { name: "Open local cart actions", exact: true });
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Open local cart actions", exact: true });
    await expectUnclipped(menu);
    await expect(menu.getByRole("menuitem", { name: "Import Project", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByText("Local Carts", { exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByText(expiredCookie, { exact: true })).toHaveCount(0);
    await page.goto("/projects");
    await expect(page.getByText("Sign In To Save And Share", { exact: true })).toBeVisible();
    await expect(page.getByText(expiredCookie, { exact: true })).toHaveCount(0);
    expect(cartChecks).toBe(0);
  });
}

test("project and cart menus handle resizing, keyboard selection, dialog focus and outside dismissal", async ({ page }) => {
  await calculatorApiKey(page);
  const project = await (await page.request.post("/api/projects", { data: { name: "Action menu regression" } })).json();
  for (const path of [`/?project=${project.id}`, "/projects"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    if (path.startsWith("/?")) await expect(page.getByRole("region", { name: "ECS flavor browser" }).getByRole("button", { name: /^Select / }).first()).toBeVisible();
    const create = page.getByRole("button", { name: "Open project actions", exact: true });
    await create.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu", { name: "Open project actions", exact: true });
    await expectUnclipped(menu);
    await expect(menu.getByRole("menuitem", { name: "Import Project", exact: true })).toBeFocused();
    await page.setViewportSize({ width: 1024, height: 667 });
    await expectUnclipped(menu);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Import Project JSON", exact: true });
    await expect(dialog).toBeVisible();
    await expect(menu).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Choose JSON file", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.setViewportSize({ width: 280, height: 667 });
    const projectTrigger = page.getByRole("button", { name: "Open actions for Action menu regression", exact: true });
    await projectTrigger.click();
    const projectMenu = page.getByRole("menu", { name: "Open actions for Action menu regression", exact: true });
    await expectUnclipped(projectMenu);
    await page.keyboard.press("Escape");
    await expect(projectTrigger).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 900 });
    await projectTrigger.click();
    // Opening a different action menu dismisses the first, even across portal boundaries.
    await create.click();
    await expect(projectMenu).toHaveCount(0);
    await expectUnclipped(menu);
    await page.keyboard.press("Escape");
    await expect(create).toBeFocused();
  }
});

test("signed-in users still see expired Huawei cookies and sign-out stops automatic checks", async ({ page }) => {
  await calculatorApiKey(page);
  await page.addInitScript(() => localStorage.setItem("neoCalculator.huaweiCookie", "expired-demo-cookie"));
  let cartChecks = 0;
  await page.route("**/api/huawei/carts", route => {
    cartChecks++;
    return route.fulfill({ status: 401, json: { error: expiredCookie } });
  });
  for (const path of ["/", "/projects"]) {
    await page.goto(path);
    await expect(page.getByText(expiredCookie, { exact: true })).toBeVisible();
  }
  expect(cartChecks).toBeGreaterThanOrEqual(2);
  const signOut = await page.request.post("/api/auth/sign-out", { data: {} });
  expect(signOut.ok()).toBe(true);
  const checksBeforeSignOut = cartChecks;
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New Cart", exact: true })).toBeEnabled();
  await expect(page.getByText(expiredCookie, { exact: true })).toHaveCount(0);
  expect(cartChecks).toBe(checksBeforeSignOut);
});

test("menu rename preserves editor focus and project-page rename still saves", async ({ page }) => {
  await calculatorApiKey(page);
  for (const path of ["/", "/projects"]) {
    const name = `Menu rename ${crypto.randomUUID()}`;
    const project = await (await page.request.post("/api/projects", { data: { name } })).json();
    await page.goto(`${path}?project=${project.id}`);
    if (path === "/") {
      await page.getByRole("button", { name: `Open actions for ${name}`, exact: true }).click();
      await page.getByRole("menuitem", { name: "Rename Project", exact: true }).click();
    } else {
      await page.getByRole("button", { name: `Rename ${name}`, exact: true }).click();
    }
    const editor = page.getByPlaceholder("Project name", { exact: true });
    await expect(editor).toBeFocused();
    await editor.fill(`${name} updated`);
    await editor.press("Enter");
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Open actions for ${name} updated`, exact: true })).toBeVisible();
  }
});
