import { expect, test } from "@playwright/test";
import { calculatorApiKey } from "./calculator-api-fixture";

test.beforeEach(({ baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
});

for (const width of [280, 375, 1440]) {
  test(`navigation and the single service picker remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    await expect(page.getByTestId("lab-price")).toBeVisible();
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Calculator", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Service", exact: true })).toHaveCount(1);
    expect(await header.evaluate(element => {
      const brand = element.querySelector('a[href="/"]')!;
      const docs = element.querySelector('a[href="/docs"]')!;
      const text = document.createRange();
      text.selectNodeContents(brand);
      return text.getBoundingClientRect().right <= docs.getBoundingClientRect().left &&
        element.getBoundingClientRect().height < 130 && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await page.screenshot({ path: `/tmp/neo-ui-after-home-${width}.png`, fullPage: true });

    const picker = page.getByRole("button", { name: "Service", exact: true });
    await picker.click();
    const dialog = page.getByRole("dialog", { name: "Choose service", exact: true });
    await expect(dialog.getByRole("combobox", { name: "Search services", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(picker).toBeFocused();
    await page.keyboard.press("Control+k");
    await dialog.getByRole("combobox").fill("ELB");
    await dialog.getByRole("option", { name: /Elastic Load Balance/ }).click();
    await expect(page.getByRole("heading", { name: "Elastic Load Balance", exact: true })).toBeVisible();
    await expect(page.getByTestId("lab-price")).toBeVisible();
  });
}

test("rate information and Huawei comparison remain available in price details", async ({ page }) => {
  await page.goto("/?service=ECS&region=ap-southeast-1");
  const price = page.getByTestId("lab-price");
  await expect(price).toBeVisible();
  await expect(page.getByLabel("Resource name", { exact: true })).toBeVisible();
  const originalPrice = await price.innerText();
  const compare = page.getByRole("link", { name: "Compare with Huawei", exact: true });
  await expect(compare).not.toBeVisible();
  await page.getByText("Price components", { exact: true }).click();
  await expect(compare).toBeVisible();
  await expect(compare).toHaveAttribute("href", /calculator\.html.*#\/ecs$/);
  await expect(page.getByText(/^Rates updated /)).toBeVisible();
  expect(await price.innerText()).toBe(originalPrice);
  await expect(page.getByRole("button", { name: "Queue for batch", exact: true })).toBeEnabled();
  await page.getByRole("group", { name: "Huawei billing mode", exact: true }).getByRole("button", { name: "RI", exact: true }).click();
  await expect(page.getByText(/Pay-per-use compute references\./)).toBeVisible();
  await expect(page.getByTestId("native-payment")).toBeVisible();
});

test("empty carts hide unused filters and populated carts retain search and transfer actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  await expect(page.getByText("This cart is empty.", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search cart items", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  const search = page.getByRole("textbox", { name: "Search cart items", exact: true });
  await search.fill("no matching resource");
  await expect(page.getByText("No cart items matched the current search or filter settings.")).toBeVisible();
  await search.fill("");
  const cart = page.getByRole("complementary", { name: "Cart", exact: true });
  await expect(cart.getByRole("button", { name: "Edit Elastic Cloud Server", exact: true })).toBeVisible();
  await cart.getByRole("button", { name: "Open actions for My Cart", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Open actions for My Cart", exact: true });
  for (const name of ["Share Cart", "Export Cart JSON", "Export to Huawei Cloud", "Duplicate Cart", "Delete Cart"])
    await expect(menu.getByRole("menuitem", { name, exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  page.once("dialog", dialog => dialog.accept());
  await cart.getByRole("button", { name: "Delete Elastic Cloud Server", exact: true }).click();
  await expect(page.getByText("This cart is empty.", { exact: true })).toBeVisible();
  await expect(search).toHaveCount(0);
});

test("projects direct guests to local carts and account registration remains reachable through sign-in", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toHaveCount(1);
  await expect(page.getByText("Sign in to use projects", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open local carts", exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === "/cart");
  await expect(page.getByRole("button", { name: "New Cart", exact: true })).toBeEnabled();
  await expect(page.locator("header").getByRole("link", { name: "Calculator", exact: true })).toHaveAttribute("aria-current", "page");
  await page.locator("header").getByRole("link", { name: "Sign In", exact: true }).click();
  await page.getByRole("link", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
});

for (const width of [280, 375, 1440]) test(`signed-in settings and catalog exports remain accessible at ${width}px`, async ({ page }) => {
  await calculatorApiKey(page);
  await page.setViewportSize({ width, height: 850 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "API Key", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign Out", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download Catalog", exact: true })).toBeVisible();
  expect(await page.getByRole("checkbox").count()).toBeGreaterThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
