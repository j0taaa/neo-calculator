import { expect, test } from "bun:test";

import { estimateSmnConfiguration, type SmnPricingCatalog } from "@/lib/smn-catalog";

const catalog: SmnPricingCatalog = {
  currency: "USD",
  regionId: "eu-west-0",
  tiers: [
    {
      label: "HTTP/HTTPS",
      resourceSpecCode: "smn.http",
      prices: { ONDEMAND: 0.005 },
      productIds: { ONDEMAND: "smn.http" },
    },
    {
      label: "Email",
      resourceSpecCode: "smn.email",
      prices: { ONDEMAND: 0.003 },
      productIds: { ONDEMAND: "smn.email" },
    },
  ],
};

test("SMN estimates HTTP/HTTPS protocol cost", () => {
  const result = estimateSmnConfiguration(catalog, {
    protocolType: "HTTP/HTTPS",
    quantity: 1,
    usageHours: 744,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(3.72, 2);
  expect(result!.currency).toBe("USD");
  expect(result!.suffix).toBe("/744h");
  expect(result!.quantity).toBe(1);
  expect(result!.usageHours).toBe(744);
  expect(result!.breakdown).toHaveLength(1);
  expect(result!.breakdown[0].label).toBe("1 x HTTP/HTTPS");
});

test("SMN estimates Email protocol cost", () => {
  const result = estimateSmnConfiguration(catalog, {
    protocolType: "Email",
    quantity: 2,
    usageHours: 744,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(4.46, 2);
  expect(result!.quantity).toBe(2);
});

test("SMN returns null for unknown protocol", () => {
  const result = estimateSmnConfiguration(catalog, {
    protocolType: "SMS",
    quantity: 1,
    usageHours: 744,
  });

  expect(result).toBeNull();
});
