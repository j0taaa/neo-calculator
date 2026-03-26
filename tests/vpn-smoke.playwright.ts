import { expect, test } from "@playwright/test";

test("homepage loads without runtime errors and VPN pricing API returns live catalog data", async ({ page, request }) => {
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

  const response = await request.get("http://127.0.0.1:3000/api/catalog/vpn-pricing?region=la-sao-paulo1");
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.catalogRegionId).toBe("sa-brazil-1");
  expect(payload.catalog.gateways).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        mode: "Site-to-Cloud",
        specification: "Professional 2",
        accessViaNonFixedIp: "Off",
        resourceSpecCode: "V1G",
      }),
      expect.objectContaining({
        mode: "Point-to-Cloud",
        specification: "Professional 1",
      }),
    ]),
  );
  expect(payload.catalog.publicBandwidth).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        allocation: "Dedicated bandwidth",
        resourceSpecCode: "19_bgp",
      }),
      expect.objectContaining({
        allocation: "Shared bandwidth",
        resourceSpecCode: "19_share",
      }),
    ]),
  );
});
