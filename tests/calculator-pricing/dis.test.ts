import { expect, test } from "bun:test";

import { estimateDisConfiguration, type DisPricingCatalog } from "@/lib/dis-catalog";

const catalog: DisPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  tiers: [
    {
      type: "General",
      usageFactor: "inputunitnum",
      resourceSpecCode: "dis.general.inputunitnum",
      prices: { ONDEMAND: 0.08 },
      productIds: { ONDEMAND: "dis-general-on" },
    },
    {
      type: "Advanced",
      usageFactor: "inputunitnum",
      resourceSpecCode: "dis.advanced.inputunitnum",
      prices: { ONDEMAND: 0.14 },
      productIds: { ONDEMAND: "dis-advanced-on" },
    },
  ],
};

test("DIS Pay-per-use estimate", () => {
  expect(
    estimateDisConfiguration(catalog, {
      type: "General",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(59.52, 2);

  expect(
    estimateDisConfiguration(catalog, {
      type: "Advanced",
      quantity: 2,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(208.32, 2);
});

test("DIS returns null for unknown type", () => {
  expect(
    estimateDisConfiguration(catalog, {
      type: "Nonexistent",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    }),
  ).toBeNull();
});
