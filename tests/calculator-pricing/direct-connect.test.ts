import { expect, test } from "bun:test";

import { estimateDirectConnectConfiguration, type DirectConnectPricingCatalog } from "@/lib/direct-connect-catalog";

const catalog: DirectConnectPricingCatalog = {
  currency: "USD",
  regionId: "la-south-2",
  portTiers: [
    {
      portSpeed: "1GE",
      resourceSpecCode: "1ge",
      plans: [
        { productId: "1ge-month", billingMode: "MONTHLY", periodNum: 1, amount: 138 },
        { productId: "1ge-year", billingMode: "YEARLY", periodNum: 1, amount: 1656 },
      ],
    },
    {
      portSpeed: "100GE",
      resourceSpecCode: "100ge",
      plans: [
        { productId: "100ge-month", billingMode: "MONTHLY", periodNum: 1, amount: 11700 },
        { productId: "100ge-year-1", billingMode: "YEARLY", periodNum: 1, amount: 140400 },
        { productId: "100ge-year-2", billingMode: "YEARLY", periodNum: 2, amount: 280800 },
        { productId: "100ge-year-3", billingMode: "YEARLY", periodNum: 3, amount: 421200 },
      ],
    },
  ],
};

test("Direct Connect documented price anchors stay aligned", () => {
  expect(estimateDirectConnectConfiguration(catalog, { portSpeed: "1GE", durationMonths: 1, quantity: 1 })?.amount).toBe(138);
  expect(estimateDirectConnectConfiguration(catalog, { portSpeed: "100GE", durationMonths: 1, quantity: 1 })?.amount).toBe(11700);
});
