import { expect, test } from "bun:test";

import { estimateCfwConfiguration, type CfwPricingCatalog } from "@/lib/cfw-catalog";

const catalog: CfwPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-3",
  tiers: [
    {
      edition: "Standard",
      resourceSpecCode: "cfw.standard",
      prices: { ONDEMAND: 0.012, MONTHLY: 86, YEARLY: 940 },
      productIds: { ONDEMAND: "cfw.standard.ondemand", MONTHLY: "cfw.standard.monthly", YEARLY: "cfw.standard.yearly" },
    },
    {
      edition: "Professional",
      resourceSpecCode: "cfw.professional",
      prices: { ONDEMAND: 0.035, MONTHLY: 250, YEARLY: 2740 },
      productIds: { ONDEMAND: "cfw.professional.ondemand", MONTHLY: "cfw.professional.monthly", YEARLY: "cfw.professional.yearly" },
    },
  ],
};

test("CFW estimates Standard edition Pay-per-use", () => {
  const result = estimateCfwConfiguration(catalog, {
    edition: "Standard",
    quantity: 1,
    usageHours: 744,
    billingMode: "Pay-per-use",
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(8.93, 2);
  expect(result!.currency).toBe("USD");
  expect(result!.suffix).toBe("/744h");
  expect(result!.quantity).toBe(1);
  expect(result!.usageHours).toBe(744);
  expect(result!.breakdown).toHaveLength(1);
  expect(result!.breakdown[0].label).toBe("1 x Standard");
});

test("CFW estimates Professional edition Yearly/Monthly", () => {
  const result = estimateCfwConfiguration(catalog, {
    edition: "Professional",
    quantity: 1,
    usageHours: 744,
    billingMode: "Yearly/Monthly",
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(250, 2);
  expect(result!.suffix).toBe("/mo");
  expect(result!.monthlyAverageAmount).toBe(250);
});

test("CFW estimates Standard edition with quantity > 1 Pay-per-use", () => {
  const result = estimateCfwConfiguration(catalog, {
    edition: "Standard",
    quantity: 3,
    usageHours: 744,
    billingMode: "Pay-per-use",
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(26.78, 2);
  expect(result!.quantity).toBe(3);
});

test("CFW returns null for unknown edition", () => {
  const result = estimateCfwConfiguration(catalog, {
    edition: "Enterprise",
    quantity: 1,
    usageHours: 744,
    billingMode: "Pay-per-use",
  });

  expect(result).toBeNull();
});
