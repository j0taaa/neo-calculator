import { expect, test } from "bun:test";

import { estimateCbhConfiguration, listCbhDurationMonths, listCbhEditions, listCbhInstanceTypes } from "@/lib/cbh-catalog";
import { parseCbhPricingCatalogResponse } from "@/lib/cbh-pricing";

const payload = {
  product: {
    "cbh_cbh.ins": [
      {
        resourceSpecCode: "cbh.basic.50",
        productSpecSysDesc: "Assets:50 Assets;type:Standard;mode:Single",
        Assets: "50 Assets",
        type: "Standard",
        mode: "Single",
        edition: "dataInfo_11_",
        planList: [
          { productId: "cbh-std-50-m1", billingMode: "MONTHLY", periodNum: 1, amount: 400 },
          { productId: "cbh-std-50-y1", billingMode: "YEARLY", periodNum: 1, amount: 4000 },
          { productId: "cbh-std-50-y2", billingMode: "YEARLY", periodNum: 2, amount: 6720 },
          { productId: "cbh-std-50-y3", billingMode: "YEARLY", periodNum: 3, amount: 7200 },
        ],
      },
      {
        resourceSpecCode: "cbh.basic.100",
        productSpecSysDesc: "Assets:100 Assets;type:Standard;mode:Single",
        Assets: "100 Assets",
        type: "Standard",
        mode: "Single",
        edition: "dataInfo_12_",
        planList: [
          { productId: "cbh-std-100-m1", billingMode: "MONTHLY", periodNum: 1, amount: 600 },
          { productId: "cbh-std-100-y1", billingMode: "YEARLY", periodNum: 1, amount: 6000 },
          { productId: "cbh-std-100-y2", billingMode: "YEARLY", periodNum: 2, amount: 10080 },
          { productId: "cbh-std-100-y3", billingMode: "YEARLY", periodNum: 3, amount: 10800 },
        ],
      },
      {
        resourceSpecCode: "cbh.enhance.100",
        productSpecSysDesc: "Assets:100 Assets;type:Professional;mode:Single",
        Assets: "100 Assets",
        type: "Professional",
        mode: "Single",
        edition: "dataInfo_13_",
        planList: [
          { productId: "cbh-pro-100-m1", billingMode: "MONTHLY", periodNum: 1, amount: 900 },
          { productId: "cbh-pro-100-y1", billingMode: "YEARLY", periodNum: 1, amount: 9000 },
          { productId: "cbh-pro-100-y2", billingMode: "YEARLY", periodNum: 2, amount: 15120 },
          { productId: "cbh-pro-100-y3", billingMode: "YEARLY", periodNum: 3, amount: 16200 },
        ],
      },
    ],
  },
} as const;

test("CBH parser extracts instance types, editions, and supported durations", () => {
  const catalog = parseCbhPricingCatalogResponse(payload, "ap-southeast-1");

  expect(listCbhInstanceTypes(catalog)).toEqual(["Single-node", "Primary/Standby"]);
  expect(listCbhEditions(catalog, "Single-node")).toEqual(["Standard 50", "Standard 100", "Professional 100"]);
  expect(listCbhEditions(catalog, "Primary/Standby")).toEqual(["Standard 50", "Standard 100", "Professional 100"]);
  expect(listCbhDurationMonths(catalog, "Single-node", "Standard 50")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 24, 36]);
  expect(listCbhDurationMonths(catalog, "Primary/Standby", "Standard 50")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 24, 36]);
});

test("CBH estimator uses direct monthly and yearly plans", () => {
  const catalog = parseCbhPricingCatalogResponse(payload, "ap-southeast-1");

  expect(estimateCbhConfiguration(catalog, { instanceType: "Single-node", edition: "Standard 50", durationMonths: 1, quantity: 1 })?.amount).toBe(400);
  expect(estimateCbhConfiguration(catalog, { instanceType: "Single-node", edition: "Professional 100", durationMonths: 2, quantity: 2 })?.amount).toBe(3600);
  expect(estimateCbhConfiguration(catalog, { instanceType: "Single-node", edition: "Standard 100", durationMonths: 36, quantity: 1 })?.amount).toBe(10800);
  expect(estimateCbhConfiguration(catalog, { instanceType: "Primary/Standby", edition: "Standard 50", durationMonths: 1, quantity: 1 })).toBeNull();
});
