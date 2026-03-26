import { expect, test } from "@playwright/test";

test("homepage loads without runtime errors and NAT pricing API returns live catalog data", async ({ page, request }) => {
  const runtimeErrors: string[] = [];

  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });

  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Elastic Cloud Server")).toBeVisible();
  expect(runtimeErrors).toEqual([]);

  const response = await request.get("http://127.0.0.1:3000/api/catalog/nat-pricing?region=la-sao-paulo1");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.catalogRegionId).toBe("sa-brazil-1");
  expect(payload.catalog.tiers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "Public NAT Gateway",
        size: "Small",
        prices: expect.objectContaining({ ONDEMAND: 2.438, MONTHLY: 57.3, YEARLY: 573 }),
      }),
      expect.objectContaining({
        type: "Private NAT Gateway",
        size: "Small",
        prices: expect.objectContaining({ ONDEMAND: 0.102 }),
      }),
    ]),
  );
});
