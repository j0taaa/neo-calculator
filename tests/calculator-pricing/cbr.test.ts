import { expect, test } from "bun:test";

import { estimateCbrConfiguration, type CbrPricingCatalog } from "@/lib/cbr-catalog";

const catalog: CbrPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  vaultTiers: [
    {
      vaultType: "Server",
      resourceSpecCode: "vault.backup.server.normal",
      plans: [
        { productId: "server-m1", billingMode: "MONTHLY", periodNum: 1, amount: 0.036 },
        { productId: "server-y1", billingMode: "YEARLY", periodNum: 1, amount: 0.359 },
        { productId: "server-y3", billingMode: "YEARLY", periodNum: 3, amount: 0.65 },
        { productId: "server-od", billingMode: "ONDEMAND", periodNum: null, amount: 0.00005 },
      ],
    },
  ],
};

test("CBR live catalog anchors stay aligned", () => {
  expect(estimateCbrConfiguration(catalog, {
    billingMode: "Yearly/Monthly",
    vaultType: "Server",
    vaultCapacityGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(3.6);
  expect(estimateCbrConfiguration(catalog, {
    billingMode: "Pay-per-use",
    vaultType: "Server",
    vaultCapacityGb: 100,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })?.amount).toBe(3.72);
});

test("CBR rejects impossible capacity values", () => {
  expect(estimateCbrConfiguration(catalog, {
    billingMode: "Yearly/Monthly",
    vaultType: "Server",
    vaultCapacityGb: 0,
    durationMonths: 1,
    usageHours: 744,
    quantity: 1,
  })).toBeNull();
});

