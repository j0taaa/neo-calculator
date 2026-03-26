import { expect, test } from "bun:test";

import { estimateNatConfiguration, type NatPricingCatalog } from "@/lib/nat-catalog";

const catalog: NatPricingCatalog = {
  currency: "USD",
  regionId: "test-region",
  tiers: [
    {
      type: "Public NAT Gateway",
      size: "Small",
      resourceSpecCode: "natgateway_small",
      prices: { ONDEMAND: 2.438, MONTHLY: 57.3, YEARLY: 573 },
    },
    {
      type: "Private NAT Gateway",
      size: "Small",
      resourceSpecCode: "privatenat_small",
      prices: { ONDEMAND: 0.102 },
    },
  ],
};

test("estimateNatConfiguration bills public NAT pay-per-use by day", () => {
  const estimate = estimateNatConfiguration(catalog, {
    type: "Public NAT Gateway",
    size: "Small",
    billingMode: "Pay-per-use",
    usageHours: 25,
  });

  expect(estimate).not.toBeNull();
  expect(estimate?.amount).toBe(4.876);
  expect(estimate?.suffix).toBe("/2d");
  expect(estimate?.billableDays).toBe(2);
});

test("estimateNatConfiguration bills private NAT pay-per-use by hour", () => {
  const estimate = estimateNatConfiguration(catalog, {
    type: "Private NAT Gateway",
    size: "Small",
    billingMode: "Pay-per-use",
    usageHours: 10,
  });

  expect(estimate).not.toBeNull();
  expect(estimate?.amount).toBe(1.02);
  expect(estimate?.suffix).toBe("/10h");
});

test("estimateNatConfiguration uses monthly public NAT pricing for yearly/monthly mode", () => {
  const estimate = estimateNatConfiguration(catalog, {
    type: "Public NAT Gateway",
    size: "Small",
    billingMode: "Yearly/Monthly",
    usageHours: 744,
  });

  expect(estimate).not.toBeNull();
  expect(estimate?.amount).toBe(57.3);
  expect(estimate?.suffix).toBe("/mo");
});
