import { expect, test } from "bun:test";

import { estimateDliConfiguration, type DliPricingCatalog } from "@/lib/dli-catalog";

const catalog: DliPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  tiers: [
    {
      billingItem: "Internal Table",
      specification: "100 GB",
      resourceSpecCode: "dli.table.100gb",
      prices: { MONTHLY: 12.5 },
      productIds: { MONTHLY: "dli-table-mo-1" },
    },
    {
      billingItem: "Scan",
      specification: "Package",
      resourceSpecCode: "dli.scan.package",
      prices: { MONTHLY: 25 },
      productIds: { MONTHLY: "dli-scan-mo-1" },
    },
    {
      billingItem: "Resource Pool",
      specification: "8 CU",
      resourceSpecCode: "dli.pool.8cu",
      prices: { MONTHLY: 45 },
      productIds: { MONTHLY: "dli-pool-mo-1" },
    },
  ],
};

test("DLI Yearly/Monthly estimate for different billing items", () => {
  expect(
    estimateDliConfiguration(catalog, {
      billingItem: "Internal Table",
      specification: "100 GB",
      quantity: 1,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(12.5, 2);

  expect(
    estimateDliConfiguration(catalog, {
      billingItem: "Scan",
      specification: "Package",
      quantity: 2,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(50, 2);

  expect(
    estimateDliConfiguration(catalog, {
      billingItem: "Resource Pool",
      specification: "8 CU",
      quantity: 1,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(45, 2);
});

test("DLI returns null for unknown billing item or spec", () => {
  expect(
    estimateDliConfiguration(catalog, {
      billingItem: "Unknown Item",
      specification: "100 GB",
      quantity: 1,
      billingMode: "Yearly/Monthly",
    }),
  ).toBeNull();

  expect(
    estimateDliConfiguration(catalog, {
      billingItem: "Scan",
      specification: "Nonexistent Spec",
      quantity: 1,
      billingMode: "Yearly/Monthly",
    }),
  ).toBeNull();
});
