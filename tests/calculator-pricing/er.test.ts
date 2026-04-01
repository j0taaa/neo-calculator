import { expect, test } from "bun:test";

import { estimateErConfiguration, type ErPricingCatalog } from "@/lib/er-catalog";

const catalog: ErPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
  attachmentTiers: [
    {
      resourceSpecCode: "er.vpc.attachment",
      attachmentType: "VPC",
      ratePerHour: 0.06,
      productId: "er-attachment",
    },
  ],
  trafficTiers: [
    {
      resourceSpecCode: "er.vpc.attachment.traffic",
      trafficType: "VPC",
      ratePerGb: 0.02,
      productId: "er-traffic",
    },
  ],
};

test("ER price anchors stay aligned", () => {
  expect(estimateErConfiguration(catalog, {
    attachmentQuantity: 1,
    usageHours: 744,
    trafficGb: 0,
    quantity: 1,
  })?.amount).toBe(44.64);

  expect(estimateErConfiguration(catalog, {
    attachmentQuantity: 3,
    usageHours: 744,
    trafficGb: 200,
    quantity: 2,
  })?.amount).toBe(275.84);
});

test("ER rejects impossible values", () => {
  expect(estimateErConfiguration(catalog, {
    attachmentQuantity: 1,
    usageHours: 0,
    trafficGb: 0,
    quantity: 1,
  })).toBeNull();
});
