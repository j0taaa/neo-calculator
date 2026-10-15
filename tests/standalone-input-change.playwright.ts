import { test, expect } from "@playwright/test";

const price = async (page: import("@playwright/test").Page) => Number((await page.getByTestId("lab-price").innerText()).replace(/[^\d.]/g, ""));

test("each typed duration digit and deletion updates locally without losing the input or focus", async ({ page }) => {
  for (const service of ["ECS", "ELB", "NAT"]) {
    await page.goto(`/?service=${service}&region=cn-hong-kong`);
    await expect(page.getByTestId("lab-price")).toBeVisible();
    const unit = await price(page);
    const input = page.locator('input[data-field-id="global_ONDEMANDTIME:0"]');
    await input.focus();
    const original = await input.elementHandle();
    const requests: string[] = [];
    await page.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
    await input.fill("");
    await expect(input).toBeFocused();
    await expect(page.getByTestId("lab-price")).toHaveCount(0);
    for (const [digit, value] of [["7", 7], ["2", 72], ["0", 720]] as const) {
      await input.pressSequentially(digit);
      await expect.poll(() => price(page)).toBeCloseTo(unit * value, 6);
      await expect(input).toBeFocused();
      expect(await original!.evaluate(el => el.isConnected && el === document.activeElement)).toBe(true);
    }
    await input.press("Backspace");
    await expect.poll(() => price(page)).toBeCloseTo(unit * 72, 6);
    await expect(input).toBeFocused();
    await input.fill("");
    await input.pressSequentially("0002");
    await expect(input).toHaveValue("0002");
    await expect.poll(() => price(page)).toBeCloseTo(unit * 2, 6);
    await expect(input).toBeFocused();
    expect(requests).toEqual([]);
    await page.unroute("**/*");
  }
});

test("blank, out-of-range and fractional quantities invalidate the quote and recover on change", async ({ page }) => {
  await page.goto("/?service=ECS&region=cn-hong-kong");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  const unit = await price(page), duration = page.locator('input[data-field-id="global_ONDEMANDTIME:0"]');
  for (const invalid of ["", "0", "-1", "10000"]) {
    await duration.fill(invalid);
    await expect(page.getByTestId("lab-price")).toHaveCount(0);
    await expect(duration).toBeFocused();
    await duration.fill("2");
    await expect.poll(() => price(page)).toBeCloseTo(unit * 2, 6);
    await expect(duration).toBeFocused();
  }
  const quantity = page.locator('input[data-field-id="global_QUANTITY:0"]');
  await quantity.fill("1.5");
  await expect(page.getByTestId("lab-price")).toHaveCount(0);
  await quantity.press("Tab");
  await expect(page.getByRole("alert").filter({ hasText: "whole purchase quantity" })).toBeVisible();
  await quantity.fill("2");
  await expect.poll(() => price(page)).toBeCloseTo(unit * 4, 6);
  await expect(quantity).toBeFocused();
  await expect(page.getByRole("alert").filter({ hasText: "whole purchase quantity" })).toHaveCount(0);
  // Updating another field must keep the quantity element and its accepted value.
  await duration.fill("3");
  await expect(quantity).toHaveValue("2");
  await expect.poll(() => price(page)).toBeCloseTo(unit * 6, 6);
  await duration.fill("");
  await quantity.fill("3");
  await expect(duration).toHaveValue("3");
  await expect.poll(() => price(page)).toBeCloseTo(unit * 9, 6);
});

test("fractional service capacities recalculate while typing and blur does not calculate twice", async ({ page }) => {
  await page.goto("/?service=OBS&region=ap-southeast-1");
  await expect(page.getByTestId("lab-price")).toBeVisible();
  const input = page.getByRole("spinbutton", { name: "Storage Space amount", exact: true });
  await input.fill("100");
  await expect.poll(() => price(page)).toBeGreaterThan(0);
  const hundred = await price(page);
  await input.fill("");
  await input.pressSequentially("50.5");
  await expect.poll(() => price(page)).toBeCloseTo(hundred * 0.505, 2);
  await expect(input).toHaveValue("50.5");
  await expect(input).toBeFocused();
  await page.evaluate(() => {
    (window as Window & { blurCalculations?: number }).blurCalculations = 0;
    addEventListener("neo:calculator-state", () => { (window as Window & { blurCalculations: number }).blurCalculations++; });
  });
  await input.press("Tab");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => (window as Window & { blurCalculations: number }).blurCalculations)).toBe(0);
});
