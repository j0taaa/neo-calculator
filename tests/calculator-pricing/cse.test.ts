import { expect, test } from "bun:test";

import { estimateCseConfiguration, type CsePricingCatalog } from "@/lib/cse-catalog";

const catalog: CsePricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  tiers: [
    {
      specification: "cse.s1.small",
      resourceSpecCode: "cse.s1.small",
      prices: { ONDEMAND: 0.05, MONTHLY: 36 },
      productIds: { ONDEMAND: "cse-s1-small-on", MONTHLY: "cse-s1-small-mo" },
    },
    {
      specification: "cse.s1.medium",
      resourceSpecCode: "cse.s1.medium",
      prices: { ONDEMAND: 0.10, MONTHLY: 72 },
      productIds: { ONDEMAND: "cse-s1-medium-on", MONTHLY: "cse-s1-medium-mo" },
    },
    {
      specification: "cse.s1.large",
      resourceSpecCode: "cse.s1.large",
      prices: { ONDEMAND: 0.18, MONTHLY: 130 },
      productIds: { ONDEMAND: "cse-s1-large-on", MONTHLY: "cse-s1-large-mo" },
    },
  ],
};

test("CSE Pay-per-use estimate", () => {
  expect(
    estimateCseConfiguration(catalog, {
      specification: "cse.s1.small",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(37.2, 2);

  expect(
    estimateCseConfiguration(catalog, {
      specification: "cse.s1.medium",
      quantity: 2,
      usageHours: 744,
      billingMode: "Pay-per-use",
    })?.amount,
  ).toBeCloseTo(148.8, 2);
});

test("CSE Yearly/Monthly estimate", () => {
  expect(
    estimateCseConfiguration(catalog, {
      specification: "cse.s1.small",
      quantity: 1,
      usageHours: 0,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(36, 2);

  expect(
    estimateCseConfiguration(catalog, {
      specification: "cse.s1.medium",
      quantity: 3,
      usageHours: 0,
      billingMode: "Yearly/Monthly",
    })?.amount,
  ).toBeCloseTo(216, 2);
});

test("CSE returns null for unknown spec", () => {
  expect(
    estimateCseConfiguration(catalog, {
      specification: "cse.s1.nonexistent",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    }),
  ).toBeNull();
});
