import { expect, test } from "bun:test";

import { estimateWafConfiguration, type WafPricingCatalog } from "@/lib/waf-catalog";

const catalog: WafPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  tiers: [
    {
      edition: "Standard",
      resourceSpecCode: "waf.standard",
      prices: { MONTHLY: 69, YEARLY: 756 },
      productIds: { MONTHLY: "waf.standard.monthly", YEARLY: "waf.standard.yearly" },
    },
    {
      edition: "Professional",
      resourceSpecCode: "waf.professional",
      prices: { MONTHLY: 189, YEARLY: 2070 },
      productIds: { MONTHLY: "waf.professional.monthly", YEARLY: "waf.professional.yearly" },
    },
    {
      edition: "Enterprise",
      resourceSpecCode: "waf.enterprise",
      prices: { MONTHLY: 389, YEARLY: 4269 },
      productIds: { MONTHLY: "waf.enterprise.monthly", YEARLY: "waf.enterprise.yearly" },
    },
  ],
};

test("WAF estimates Standard edition monthly cost", () => {
  const result = estimateWafConfiguration(catalog, {
    edition: "Standard",
    quantity: 1,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(69, 2);
  expect(result!.currency).toBe("USD");
  expect(result!.suffix).toBe("/mo");
  expect(result!.monthlyAverageAmount).toBe(69);
  expect(result!.quantity).toBe(1);
  expect(result!.breakdown).toHaveLength(1);
});

test("WAF estimates Professional edition with quantity > 1", () => {
  const result = estimateWafConfiguration(catalog, {
    edition: "Professional",
    quantity: 3,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(567, 2);
  expect(result!.breakdown[0].label).toBe("3 x Professional");
});

test("WAF estimates Enterprise edition monthly cost", () => {
  const result = estimateWafConfiguration(catalog, {
    edition: "Enterprise",
    quantity: 1,
  });

  expect(result).not.toBeNull();
  expect(result!.amount).toBeCloseTo(389, 2);
});

test("WAF returns null for unknown edition", () => {
  const result = estimateWafConfiguration(catalog, {
    edition: "Ultimate",
    quantity: 1,
  });

  expect(result).toBeNull();
});

test("WAF prefers MONTHLY price over YEARLY", () => {
  const result = estimateWafConfiguration(catalog, {
    edition: "Standard",
    quantity: 1,
  });

  expect(result).not.toBeNull();
  expect(result!.suffix).toBe("/mo");
  expect(result!.amount).toBeCloseTo(69, 2);
});
