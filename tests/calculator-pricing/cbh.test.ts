import { expect, test } from "bun:test";

import { estimateCbhConfiguration, type CbhPricingCatalog } from "@/lib/cbh-catalog";

const catalog: CbhPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  editionTiers: [
    {
      instanceType: "Single-node",
      edition: "Standard 50",
      editionType: "Standard",
      assetCount: 50,
      resourceSpecCode: "cbh.basic.50",
      plans: [
        { productId: "cbh-std-50-m1", billingMode: "MONTHLY", periodNum: 1, amount: 400 },
        { productId: "cbh-std-50-y1", billingMode: "YEARLY", periodNum: 1, amount: 4000 },
      ],
    },
    {
      instanceType: "Single-node",
      edition: "Professional 5000",
      editionType: "Professional",
      assetCount: 5000,
      resourceSpecCode: "cbh.enhance.5000",
      plans: [
        { productId: "cbh-pro-5000-m1", billingMode: "MONTHLY", periodNum: 1, amount: 9000 },
        { productId: "cbh-pro-5000-y1", billingMode: "YEARLY", periodNum: 1, amount: 90000 },
      ],
    },
  ],
};

test("CBH live catalog anchors stay aligned", () => {
  expect(estimateCbhConfiguration(catalog, { instanceType: "Single-node", edition: "Standard 50", durationMonths: 1, quantity: 1 })?.amount).toBe(400);
  expect(estimateCbhConfiguration(catalog, { instanceType: "Single-node", edition: "Professional 5000", durationMonths: 1, quantity: 1 })?.amount).toBe(9000);
});

test("CBH rejects unsupported durations", () => {
  expect(estimateCbhConfiguration(catalog, { instanceType: "Single-node", edition: "Standard 50", durationMonths: 10, quantity: 1 })).toBeNull();
});
