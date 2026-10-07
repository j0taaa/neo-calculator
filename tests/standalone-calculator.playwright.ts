import { test, expect, type Page } from "@playwright/test";
import { chooseControl } from "./calculator-controls";
async function price(page: Page) {
  await expect(page.getByTestId("lab-price")).toBeVisible();
  return Number(
    (await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, ""),
  );
}
test.beforeEach(async ({ baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
});
test("ECS duration updates locally, preserves flavor cards, and never sends a native POST", async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  const requests: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      new URL(r.url()).origin !== new URL(baseURL!).origin
    )
      external.push(r.url());
    if (r.method() === "POST" && r.url().includes("/api/calculator/native"))
      requests.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?service=ECS&region=cn-hong-kong");
  const original = await price(page);
  expect(original).toBeGreaterThan(0);
  const frame = page.locator('iframe[title="Local calculator rules"]');
  const frameHtml = await (
    await page.request.get((await frame.getAttribute("src"))!)
  ).text();
  expect(frameHtml).not.toContain('"proof":');
  await expect(page.getByLabel("Minimum vCPUs")).toBeVisible();
  const duration = page
    .locator('[data-field-id="global_ONDEMANDTIME:0"]')
    .filter({ hasNot: page.locator("iframe") });
  const start = Date.now();
  await duration.fill("720");
  await duration.press("Tab");
  await expect.poll(() => price(page)).toBeCloseTo(original * 720, 6);
  console.log("Local duration update milliseconds", Date.now() - start);
  expect(requests).toEqual([]);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.locator('iframe[title="Local calculator rules"]').count(),
  ).toBe(1);
});
for (const [service, mode] of [
  ["ECS", "Yearly/Monthly"],
  ["ECS", "RI"],
  ["Flexus L", "Yearly/Monthly"],
  ["ELB", "Pay-per-use"],
  ["NAT", "Pay-per-use"],
  ["DCS", "Yearly/Monthly"],
  ["OBS", "Pay-per-use"],
  ["CCM", "One-time"],
])
  test(`${service} ${mode} runs from the snapshot`, async ({ page }) => {
    await page.goto(
      `/?service=${encodeURIComponent(service)}&region=${service === "OBS" ? "sa-brazil-1" : "cn-hong-kong"}&billing=${encodeURIComponent(mode)}`,
    );
    const amount = await price(page);
    if (service === "OBS") expect(amount).toBeGreaterThanOrEqual(0);
    else expect(amount).toBeGreaterThan(0);
    await expect(page.getByLabel("Huawei billing mode")).toHaveAttribute(
      "data-value",
      (
        {
          "Yearly/Monthly": "PERIOD",
          RI: "RI",
          "One-time": "ONETIME",
          "Pay-per-use": "ONDEMAND",
        } as Record<string, string>
      )[mode],
    );
  });
test("saving and reopening a cart recomputes money locally with Huawei unreachable", async ({
  page,
}) => {
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Standalone regression",
      email: `standalone-${crypto.randomUUID()}@example.test`,
      password: "Standalone-regression-2026",
    },
  });
  expect(signup.ok()).toBe(true);
  const project = await (
      await page.request.post("/api/projects", {
        data: { name: "Standalone regression" },
      })
    ).json(),
    list = await (
      await page.request.post(`/api/projects/${project.id}/lists`, {
        data: { name: "Offline cart" },
      })
    ).json();
  await page.goto(
    `/?service=NAT&region=cn-hong-kong&project=${project.id}&list=${list.id}`,
  );
  const original = await price(page);
  await page.getByRole("button", { name: "Add to List", exact: true }).click();
  await expect(
    page.getByText("Product added using synchronized rates."),
  ).toBeVisible();
  const projects = await (await page.request.get("/api/projects")).json();
  const products = projects
    .find((p: { id: number }) => p.id === project.id)
    .lists.find((l: { id: number }) => l.id === list.id).products;
  expect(products).toHaveLength(1);
  expect(products[0].pricing.amount).toBe(original);
  expect(products[0].pricing.source).toBe("huawei-catalog");
  const tampered = structuredClone(products[0]);
  tampered.quantity = 999;
  tampered.pricing.amount = 0;
  tampered.config.local.pricing.result.amount = 0;
  const checked = await page.request.post(`/api/lists/${list.id}/products`, {
    data: tampered,
  });
  expect(checked.ok()).toBe(true);
  const verified = await checked.json();
  expect(verified.pricing.amount).toBe(original);
  expect(verified.quantity).toBe(1);
  await page.goto(
    `/?service=NAT&region=cn-hong-kong&project=${project.id}&list=${list.id}&editProduct=${products[0].id}&editList=${list.id}`,
  );
  expect(await price(page)).toBe(original);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByText("Product updated using synchronized rates."),
  ).toBeVisible();
  await page
    .getByRole("tabpanel", { name: "Calculator", exact: true })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Queue for batch", exact: true })
    .click();
  await page.getByRole("tab", { name: "Batch add (1)", exact: true }).click();
  await page
    .getByRole("button", { name: "Save queued configurations", exact: true })
    .click();
  await expect(
    page.getByText("Added 1 configuration using synchronized prices."),
  ).toBeVisible();
  const batched = await (
    await page.request.get(`/api/lists/${list.id}/products`)
  ).json();
  expect(batched).toHaveLength(3);
  expect(
    batched.every(
      (product: { pricing: { amount: number } }) =>
        product.pricing.amount === original,
    ),
  ).toBe(true);
  const cart = page.getByRole("button", { name: /^Offline cart/ });
  if (!(await cart.isVisible()))
    await page
      .getByRole("button", { name: "Expand project", exact: true })
      .click();
  await cart.click();
  await page
    .getByRole("button", { name: "Open actions for Offline cart", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Export Cart JSON", exact: true })
    .click();
  const exported = JSON.parse(
    await page
      .getByRole("textbox", { name: "Resource export JSON" })
      .inputValue(),
  );
  const imported = await page.request.post("/api/import", {
    data: { payload: exported, targetProjectId: project.id },
  });
  expect(imported.status()).toBe(201);
  expect((await imported.json()).importedProductCount).toBe(3);
});
test("regional billing availability and switching services clean up hidden frames", async ({
  page,
}) => {
  await page.goto("/?service=SFS&region=sa-brazil-1");
  await price(page);
  await expect(
    page
      .getByLabel("Huawei billing mode")
      .getByRole("button", { name: "Yearly/Monthly", exact: true }),
  ).toHaveCount(0);
  await chooseControl(page, page.getByLabel("Service", { exact: true }), "ELB");
  await price(page);
  expect(
    await page.locator('iframe[title="Local calculator rules"]').count(),
  ).toBe(1);
  await page.getByRole("tab", { name: "Batch add", exact: true }).click();
  await expect(
    page.locator('iframe[title="Local calculator rules"]'),
  ).toHaveCount(1);
});
test("mobile calculator has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?service=ECS&region=cn-hong-kong");
  await price(page);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391);
});
