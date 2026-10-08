import { test, expect, type Page } from "@playwright/test";
import { chooseControl } from "./calculator-controls";
import {
  readFormInDocument,
  validateNativeValue,
} from "../lib/huawei-native/native-dom";
async function price(page: Page) {
  await expect(page.getByTestId("lab-price")).toBeVisible();
  return Number(
    (await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, ""),
  );
}
test.beforeEach(async ({ baseURL }) => {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
});
test("official radio choices preserve hidden and CSS-disabled states", async ({
  page,
}) => {
  await page.setContent(`<div id="global_PERIODTIME"><div class="base-radio-group"><ul>
    <li style="display:none"><button>Hidden term</button></li>
    <li class="active"><button>1 month</button></li>
    <li><button>1 year</button></li>
    <li><button class="disabled" tabindex="-1">2 years</button></li>
    <li><button disabled>3 years</button></li>
  </ul></div></div>`);
  await page.evaluate(() =>
    Object.assign(window, { viewConfig: { calc_view: { components: [] } } }),
  );
  const form = await page.evaluate(readFormInDocument);
  const field = form.fields[0];
  expect(form.diagnostics).toEqual([]);
  expect(field.options).toEqual([
    { value: "0", label: "1 month", disabled: false },
    { value: "1", label: "1 year", disabled: false },
    { value: "2", label: "2 years", disabled: true },
    { value: "3", label: "3 years", disabled: true },
  ]);
  expect(() => validateNativeValue(field, "2")).toThrow("Invalid option");
  expect(
    await page.locator('[data-neo-option="global_PERIODTIME:0:1"]').innerText(),
  ).toBe("1 year");
});
test("numeric unit selectors are distinguishable from categorical dropdowns", async ({
  page,
}) => {
  await page.setContent(`<div id="usage"><div class="base-stepper">
    <input class="tiny-numeric__input-inner" value="1" min="0" max="9999">
    <div class="base-select"><input readonly value="GB"><div class="tiny-select-dropdown" style="display:none">
      <li class="tiny-select-dropdown__item selected">GB</li><li class="tiny-select-dropdown__item">TB</li><li class="tiny-select-dropdown__item">PB</li>
    </div></div></div></div>`);
  await page.evaluate(() =>
    Object.assign(window, {
      viewConfig: {
        calc_view: { components: [{ id: "usage", type: "CommonStepper" }] },
      },
    }),
  );
  const form = await page.evaluate(readFormInDocument);
  expect(form.diagnostics).toEqual([]);
  expect(form.fields[1].unitSelector).toBe(true);
  expect(form.fields[1].options!.map((option) => option.label)).toEqual([
    "GB",
    "TB",
    "PB",
  ]);
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
test("CDN traffic prices remain correct across GB, TB and PB", async ({
  page,
}) => {
  await page.goto("/?service=CDN&region=global-cbc-1&billing=Pay-per-use");
  await price(page);
  await chooseControl(
    page,
    page.locator('[data-field-id="calculator_demand_billType_radio:0"]'),
    { label: "Traffic" },
  );
  await price(page);
  const amount = page.locator(
    'input[data-field-id="calculator_demand_billType_radio:1"]',
  );
  await amount.fill("1");
  await amount.press("Tab");
  await expect.poll(() => price(page)).toBeCloseTo(0.115, 6);
  await chooseControl(
    page,
    page.locator('[data-field-id="calculator_demand_billType_radio:2"]'),
    { label: "TB" },
  );
  await expect.poll(() => price(page)).toBeCloseTo(117.76, 6);
  await chooseControl(
    page,
    page.locator('[data-field-id="calculator_demand_billType_radio:2"]'),
    { label: "PB" },
  );
  await expect.poll(() => price(page)).toBeCloseTo(82456.576, 6);
});
test("ECS HomeZone selection uses zone-specific flavors and prices", async ({
  page,
}) => {
  await page.goto("/?service=ECS&region=af-south-1");
  await price(page);
  const common = await (
    await page.request.get("/api/catalog/ecs-flavors?region=af-south-1")
  ).json();
  await chooseControl(
    page,
    page.locator('[data-field-id="global_LOCATIONTYPE:0"]'),
    { label: "HomeZones" },
  );
  await expect.poll(() => price(page)).toBeCloseTo(0.13344, 6);
  await expect(page.getByText("LOS1-AZ1", { exact: true })).toBeVisible();
  const zone = await (
    await page.request.get(
      "/api/catalog/ecs-flavors?region=af-south-1&locationCode=af-south-1-los1a",
    )
  ).json();
  expect(zone.flavors.length).toBeGreaterThan(0);
  expect(zone.flavors.length).toBeLessThan(common.flavors.length);
  await page.getByLabel("Search flavors").fill("c7n.xlarge.2.linux");
  await page
    .getByRole("button", { name: "Select c7n.xlarge.2.linux", exact: true })
    .click();
  const hourly = await price(page);
  const duration = page.locator('input[data-field-id="global_ONDEMANDTIME:0"]');
  await duration.fill("24");
  await duration.press("Tab");
  await expect.poll(() => price(page)).toBeCloseTo(hourly * 24, 6);
});
test("partner-region forms and beta-only services calculate offline", async ({
  page,
}) => {
  await page.goto("/?service=SFS%20Turbo&region=eu-west-0");
  expect(await price(page)).toBeGreaterThan(0);
  await expect(page.getByLabel("Huawei region")).toHaveAttribute(
    "data-value",
    "eu-west-0",
  );
  await page.goto("/?service=HUAWEI%3Amaas&region=ap-southeast-1");
  await expect.poll(() => price(page)).toBeCloseTo(0.405, 6);
  const input = page.getByRole("spinbutton", { name: "Input", exact: true });
  await input.fill("2");
  await input.press("Tab");
  await expect.poll(() => price(page)).toBeCloseTo(0.54, 6);
});
test("informational official modes show their notes without a fabricated zero estimate", async ({
  page,
}) => {
  await page.goto("/?service=DSC&region=ap-southeast-1&billing=Pay-per-use");
  await expect(page.getByTestId("scope-status")).toHaveText(
    "Huawei provides billing information for this mode, without a quotation form.",
  );
  await expect(
    page.getByText(
      /The pay-per-use DSC function does not need to be purchased separately/,
    ),
  ).toBeVisible();
  await expect(page.getByTestId("lab-price")).toHaveCount(0);
});
test("Support Plans tier arithmetic and subscription duration save from local rules", async ({
  page,
}) => {
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Support regression",
      email: `support-${crypto.randomUUID()}@example.test`,
      password: "Standalone-regression-2026",
    },
  });
  expect(signup.ok()).toBe(true);
  const project = await (
    await page.request.post("/api/projects", {
      data: { name: "Support regression" },
    })
  ).json();
  const list = await (
    await page.request.post(`/api/projects/${project.id}/lists`, {
      data: { name: "Support cart" },
    })
  ).json();
  await page.goto(
    `/?service=HUAWEI%3Asupportplans&region=ap-southeast-1&project=${project.id}&list=${list.id}`,
  );
  await expect.poll(() => price(page)).toBe(26);
  await chooseControl(
    page,
    page.locator('[data-field-id="calculator_support_radio:0"]'),
    { label: "Business" },
  );
  const expenditure = page.getByRole("spinbutton", {
    name: "Monthly Expenditure",
    exact: true,
  });
  await expect(expenditure).toHaveValue("1000");
  await expect.poll(() => price(page)).toBe(100);
  await expenditure.fill("1");
  await expenditure.press("Tab");
  await expect.poll(() => price(page)).toBe(90);
  await expenditure.fill("9000");
  await expenditure.press("Tab");
  await expect.poll(() => price(page)).toBe(900);
  await chooseControl(
    page,
    page.locator('[data-field-id="global_PERIODTIME:0"]'),
    { label: "1 year" },
  );
  await expect.poll(() => price(page)).toBe(10800);
  await page.getByRole("button", { name: "Add to List", exact: true }).click();
  await expect(
    page.getByText("Product added using synchronized rates."),
  ).toBeVisible();
  const projects = await (await page.request.get("/api/projects")).json();
  const products = projects.find((p: { id: number }) => p.id === project.id).lists.find((l: { id: number }) => l.id === list.id).products;
  expect(products[0].pricing.amount).toBe(10800);
  expect(products[0].pricing.source).toBe("huawei-catalog");
  const tampered = structuredClone(products[0]);
  tampered.pricing.amount = 0;
  tampered.config.local.pricing.selectedProduct.productAllInfos[0].supportAmount = 0;
  const checked = await page.request.post(`/api/lists/${list.id}/products`, { data: tampered });
  expect(checked.ok()).toBe(true);
  expect((await checked.json()).pricing.amount).toBe(10800);
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
