import { expect, test } from "bun:test";

import { estimateErConfiguration } from "@/lib/er-catalog";
import { parseErPricingCatalogResponse } from "@/lib/er-pricing";

const payload = {
  product: {
    "er_er.attachment": [
      {
        resourceSpecCode: "er.vpc.attachment",
        "attachment type": "VPC",
        planList: [
          {
            productId: "er-attachment",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.er.erattachment.duration",
            amount: 0.06,
          },
        ],
      },
    ],
    "er_er.traffic": [
      {
        resourceSpecCode: "er.vpc.attachment.traffic",
        "traffic type": "VPC",
        planList: [
          {
            productId: "er-traffic",
            billingMode: "ONDEMAND",
            billingEvent: "event.type.er.ertraffic.downflow",
            amount: 0.02,
          },
        ],
      },
    ],
  },
} as const;

test("ER parser extracts attachment and traffic rates", () => {
  const catalog = parseErPricingCatalogResponse(payload, "sa-brazil-1");

  expect(catalog.attachmentTiers[0]).toMatchObject({
    resourceSpecCode: "er.vpc.attachment",
    attachmentType: "VPC",
    ratePerHour: 0.06,
    productId: "er-attachment",
  });
  expect(catalog.trafficTiers[0]).toMatchObject({
    resourceSpecCode: "er.vpc.attachment.traffic",
    trafficType: "VPC",
    ratePerGb: 0.02,
    productId: "er-traffic",
  });
});

test("ER estimator multiplies attachment hours and traffic", () => {
  const catalog = parseErPricingCatalogResponse(payload, "sa-brazil-1");

  expect(estimateErConfiguration(catalog, {
    attachmentQuantity: 3,
    usageHours: 744,
    trafficGb: 200,
    quantity: 2,
  })?.amount).toBe(275.84);
});

test("ER estimator rejects impossible values", () => {
  const catalog = parseErPricingCatalogResponse(payload, "sa-brazil-1");

  expect(estimateErConfiguration(catalog, {
    attachmentQuantity: 0,
    usageHours: 744,
    trafficGb: 0,
    quantity: 1,
  })).toBeNull();
});
