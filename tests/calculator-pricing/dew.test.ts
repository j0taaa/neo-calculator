import { expect, test } from "bun:test";

import { estimateDewConfiguration, type DewPricingCatalog } from "@/lib/dew-catalog";

const catalog: DewPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  tiers: [
    {
      label: "Customer Master Key",
      resourceSpecCode: "dew.csms.key",
      prices: { ONDEMAND: 0.0069 },
      productIds: { ONDEMAND: "dew.csms.key" },
    },
    {
      label: "HSM Key",
      resourceSpecCode: "dew.kms.key",
      prices: { ONDEMAND: 0.02 },
      productIds: { ONDEMAND: "dew.kms.key" },
    },
  ],
};

test("DEW estimates Customer Master Key cost", () => {
  const result = estimateDewConfiguration(catalog, {
    keyType: "Customer Master Key",
    quantity: 1,
    usageHours: 744,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(5.13, 2);
  expect(result!.currency).toBe("USD");
  expect(result!.suffix).toBe("/744h");
  expect(result!.quantity).toBe(1);
  expect(result!.usageHours).toBe(744);
  expect(result!.breakdown).toHaveLength(1);
});

test("DEW estimates HSM Key cost with quantity > 1", () => {
  const result = estimateDewConfiguration(catalog, {
    keyType: "HSM Key",
    quantity: 3,
    usageHours: 744,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(44.64, 2);
  expect(result!.quantity).toBe(3);
  expect(result!.breakdown[0].label).toBe("3 x HSM Key");
});

test("DEW returns null for unknown key type", () => {
  const result = estimateDewConfiguration(catalog, {
    keyType: "Unknown",
    quantity: 1,
    usageHours: 744,
  });

  expect(result).toBeNull();
});

test("DEW returns null for zero usage hours", () => {
  const result = estimateDewConfiguration(catalog, {
    keyType: "Customer Master Key",
    quantity: 1,
    usageHours: 0,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(0.0069, 2);
});
