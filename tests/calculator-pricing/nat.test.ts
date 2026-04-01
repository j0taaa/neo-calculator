import { expect, test } from "bun:test";

import { estimateNatConfiguration, type NatPricingCatalog } from "@/lib/nat-catalog";

const catalog: NatPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
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

test("NAT pricing calculations stay aligned for public and private gateways", () => {
  expect(
    estimateNatConfiguration(catalog, {
      type: "Public NAT Gateway",
      size: "Small",
      billingMode: "Pay-per-use",
      usageHours: 25,
    })?.amount,
  ).toBe(4.876);

  expect(
    estimateNatConfiguration(catalog, {
      type: "Private NAT Gateway",
      size: "Small",
      billingMode: "Pay-per-use",
      usageHours: 10,
    })?.amount,
  ).toBe(1.02);

  expect(
    estimateNatConfiguration(catalog, {
      type: "Public NAT Gateway",
      size: "Small",
      billingMode: "Yearly/Monthly",
      usageHours: 744,
    })?.amount,
  ).toBe(57.3);
});

test("NAT rejects non-positive usage durations", () => {
  expect(
    estimateNatConfiguration(catalog, {
      type: "Private NAT Gateway",
      size: "Small",
      billingMode: "Pay-per-use",
      usageHours: 0,
    }),
  ).toBeNull();
});
