import { expect, test, type Page } from "@playwright/test";
import dcsCatalog from "./fixtures/runtime/dcs.json";
import diskPricing from "./fixtures/runtime/evs.json";

const viewports = [
  [320, 640], [375, 667], [390, 844], [640, 800], [768, 1024],
  [1024, 768], [1279, 800], [1280, 800], [1366, 768], [1440, 900],
  [1512, 982], [1920, 1080],
];

async function expectControlsToFit(page: Page) {
  const dimensions = await page.evaluate(() => {
    const panel = document.querySelector(".dashboard-calculator")!.getBoundingClientRect();
    const clipped = [...document.querySelectorAll(".dashboard-calculator button, .dashboard-calculator input, .dashboard-calculator select, .dashboard-calculator textarea, header a, header button")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height || element.getAttribute("aria-hidden") === "true") return false;
        const bounds = element.closest("header") ? { left: 0, right: innerWidth } : panel;
        return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
      })
      .map((element) => element.getAttribute("aria-label") ?? element.textContent?.trim());
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, clipped };
  });
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.clipped).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/catalog/ecs-flavors?*", (route) => route.fulfill({ json: {
    flavors: [{ resourceSpecCode: "c7.large.4", family: "c7", architecture: "x86", series: "c",
      description: "General Computing", cpu: 2, ramGiB: 8,
      prices: { ONDEMAND: 0.1, MONTHLY: 50, RI: 400 }, currency: "USD", updatedAt: "2026-01-01" }],
    diskPricing,
  } }));
  await page.route("**/api/catalog/dcs-pricing?*", (route) => route.fulfill({ json: {
    region: "la-sao-paulo1", catalogRegionId: "sa-brazil-1", catalog: dcsCatalog,
  } }));
  await page.route("**/api/calculator/native", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: {
        services: [{ id: "ecs", name: "Elastic Cloud Server" }],
        regions: [{ id: "ap-southeast-1", name: "Hong Kong" }],
        billingModes: { ecs: { "ap-southeast-1": ["ONDEMAND"] } },
      } });
      return;
    }
    await route.fulfill({ json: {
      session: "responsive-fixture", revision: 1, service: "ecs", region: "ap-southeast-1",
      billingMode: "ONDEMAND", notes: [], diagnostics: [],
      fields: [
        { id: "flavor", label: "Flavor", type: "select", value: "large", disabled: false,
          options: [{ value: "large", label: "General Computing · c7.large.4 · 2 vCPUs · 8 GiB RAM", disabled: false }] },
        { id: "quantity", label: "Quantity", type: "number", value: 1, disabled: false, min: 1, max: 100 },
      ],
      quote: { currency: "USD", amount: 77.73, quotedAt: "2026-10-06T12:00:00Z", breakdown: [] },
    } });
  });
});

for (const [width, height] of viewports) {
  test(`calculator, search and live controls fit ${width}×${height} at 100% zoom`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("button", { name: /c7.large.4/ })).toBeVisible();
    await expectControlsToFit(page);

    const estimate = page.locator(".dashboard-calculator .sticky");
    const initial = await estimate.boundingBox();
    expect(initial!.y + initial!.height).toBeLessThanOrEqual(height);
    await page.getByRole("textbox", { name: "Instance quantity", exact: true }).fill("3");
    await expect(estimate).toContainText("3 Instances");
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await page.getByText("Selected specifications:", { exact: false }).scrollIntoViewIfNeeded();
    await expectControlsToFit(page);

    await page.getByRole("button", { name: "Open service search" }).click();
    await page.getByRole("combobox", { name: "Search services" }).fill("DCS");
    await page.getByRole("option").filter({ hasText: "Distributed Cache Service" }).click();
    await expect(page.getByText("Loading DCS pricing...", { exact: true })).toBeHidden();
    await expectControlsToFit(page);

    await page.getByRole("tab", { name: "Batch add", exact: true }).click();
    await expect(page.locator("textarea")).toBeVisible();
    await expectControlsToFit(page);
    await page.getByRole("tab", { name: "Huawei live", exact: true }).click();
    await page.getByRole("button", { name: "Open calculator", exact: true }).click();
    await expect(page.getByTestId("lab-price")).toContainText("77.73");
    await expectControlsToFit(page);
    await page.screenshot({ path: testInfo.outputPath(`live-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("signed-in navigation, projects, carts and settings fit with long names", async ({ page, baseURL }) => {
  test.skip(!["127.0.0.1", "localhost"].includes(new URL(baseURL!).hostname), "Creates an isolated local test account");
  const signup = await page.request.post("/api/auth/sign-up/email", { data: {
    name: "A long account name for responsive layout verification",
    email: `responsive-${crypto.randomUUID()}@example.test`, password: "Responsive-test-password-2026",
  } });
  expect(signup.ok()).toBe(true);
  const projectResponse = await page.request.post("/api/projects", { data: { name: "A project with a long name for a customer deployment" } });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json();
  const listResponse = await page.request.post(`/api/projects/${project.id}/lists`, { data: { name: "A cart with a long name for the production environment" } });
  expect(listResponse.status()).toBe(201);
  const list = await listResponse.json();

  for (const width of [390, 1024, 1280, 1512, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/?project=${project.id}&list=${list.id}`);
    await expect(page.getByRole("button", { name: "Add to List", exact: true })).toBeEnabled();
    await expectControlsToFit(page);
    await page.getByRole("button", { name: "Open settings", exact: true }).click();
    await expect(page.getByText("Huawei Cloud Cookie", { exact: true })).toBeVisible();
    const settings = await page.getByText("Huawei Cloud Cookie", { exact: true }).evaluate((element) => element.closest(".z-50")!.getBoundingClientRect().toJSON());
    expect(settings.left).toBeGreaterThanOrEqual(0);
    expect(settings.right).toBeLessThanOrEqual(width);
  }
});
