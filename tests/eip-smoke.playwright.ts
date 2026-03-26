import { expect, test } from "@playwright/test";

test("homepage loads without runtime errors and EIP pricing API returns live catalog data", async ({ page, request }) => {
  const runtimeErrors: string[] = [];

  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });

  await page.goto("http://hwctools.site:3000", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Elastic Cloud Server")).toBeVisible();
  expect(runtimeErrors).toEqual([]);

  const response = await request.get("http://hwctools.site:3000/api/catalog/eip-pricing?region=la-sao-paulo1");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.catalogRegionId).toBe("sa-brazil-1");
  expect(payload.catalog.dedicated.eipRates.ONDEMAND).toBe(0.005);
  expect(payload.catalog.dedicated.bandwidthRates.ONDEMAND).toBe(0.0281);
  expect(payload.catalog.dedicated.trafficRatePerGb).toBe(0.135);
  expect(payload.catalog.shared.bandwidthRates.ONDEMAND).toBe(0.0281);
  expect(payload.catalog.shared.enhanced95MonthlyBaseRate).toBe(20.25);
  expect(payload.catalog.dedicated.trafficRateTiers).toEqual([
    { startGb: 0, upToGb: 10, amountPerGb: 0.135 },
    { startGb: 10, upToGb: 50, amountPerGb: 0.124 },
    { startGb: 50, upToGb: 150, amountPerGb: 0.113 },
    { startGb: 150, upToGb: null, amountPerGb: 0.103 },
  ]);
  expect(payload.catalog.dedicated.trafficPackages.MONTHLY.slice(0, 3)).toEqual([
    expect.objectContaining({ sizeGb: 10, amount: 1.2 }),
    expect.objectContaining({ sizeGb: 50, amount: 6.1 }),
    expect.objectContaining({ sizeGb: 100, amount: 12.2 }),
  ]);
});
