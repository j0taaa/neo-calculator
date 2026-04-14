import { expect, test } from "bun:test";

import { estimateDwsConfiguration, type DwsPricingCatalog } from "@/lib/dws-catalog";

const catalog: DwsPricingCatalog = {
  currency: "USD",
  regionId: "eu-west-1",
  tiers: [
    {
      specification: "dwsx.8xlarge",
      resourceSpecCode: "dws.dwsx.8xlarge",
      prices: { ONDEMAND: 0.35, MONTHLY: 250 },
      productIds: { ONDEMAND: "dws-on-1", MONTHLY: "dws-mo-1" },
    },
    {
      specification: "dwsx.2xlarge",
      resourceSpecCode: "dws.dwsx.2xlarge",
      prices: { ONDEMAND: 0.12, MONTHLY: 85 },
      productIds: { ONDEMAND: "dws-on-2", MONTHLY: "dws-mo-2" },
    },
    {
      specification: "dwsk.4xlarge",
      resourceSpecCode: "dws.dwsk.4xlarge",
      prices: { ONDEMAND: 0.20, MONTHLY: 145 },
      productIds: { ONDEMAND: "dws-on-3", MONTHLY: "dws-mo-3" },
    },
  ],
};

test("DWS Pay-per-use estimate", () => {
  expect(
    estimateDwsConfiguration(catalog, {
      specification: "dwsx.8xlarge",
      storageType: "Ultra-high I/O",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(260.4, 2);

  expect(
    estimateDwsConfiguration(catalog, {
      specification: "dwsx.2xlarge",
      storageType: "High I/O",
      quantity: 3,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(267.84, 2);
});

test("DWS Yearly/Monthly estimate", () => {
  expect(
    estimateDwsConfiguration(catalog, {
      specification: "dwsx.8xlarge",
      storageType: "Ultra-high I/O",
      quantity: 1,
      usageHours: 0,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(250, 2);

  expect(
    estimateDwsConfiguration(catalog, {
      specification: "dwsk.4xlarge",
      storageType: "Common I/O",
      quantity: 2,
      usageHours: 0,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(290, 2);
});

test("DWS returns null for unknown spec", () => {
  expect(
    estimateDwsConfiguration(catalog, {
      specification: "dwsx.999xlarge",
      storageType: "Ultra-high I/O",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    }),
  ).toBeNull();
});
