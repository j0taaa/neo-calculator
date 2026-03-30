import { expect, test } from "bun:test";

import { estimateDirectConnectConfiguration, listDirectConnectDurationMonths, listDirectConnectPortSpeeds } from "@/lib/direct-connect-catalog";
import { parseDirectConnectPricingCatalogResponse } from "@/lib/direct-connect-pricing";

const payload = {
  product: {
    "dcaas_dcaas.port": [
      {
        resourceSpecCode: "1ge",
        productSpecSysDesc: "PortType:1PCS",
        PortType: "1BSSUNIT.unit.41",
        planList: [
          { productId: "1ge-month", billingMode: "MONTHLY", periodNum: 1, amount: 116 },
          { productId: "1ge-year", billingMode: "YEARLY", periodNum: 1, amount: 1392 },
        ],
      },
      {
        resourceSpecCode: "10ge",
        productSpecSysDesc: "PortType:10PCS",
        PortType: "10BSSUNIT.pluralUnit.41",
        planList: [
          { productId: "10ge-month", billingMode: "MONTHLY", periodNum: 1, amount: 985 },
          { productId: "10ge-year", billingMode: "YEARLY", periodNum: 1, amount: 11820 },
        ],
      },
      {
        resourceSpecCode: "40ge",
        productSpecSysDesc: "PortType:40PCS",
        PortType: "40BSSUNIT.pluralUnit.41",
        planList: [
          { productId: "40ge-month", billingMode: "MONTHLY", periodNum: 1, amount: 5500 },
          { productId: "40ge-year-1", billingMode: "YEARLY", periodNum: 1, amount: 66000 },
          { productId: "40ge-year-2", billingMode: "YEARLY", periodNum: 2, amount: 132000 },
          { productId: "40ge-year-3", billingMode: "YEARLY", periodNum: 3, amount: 198000 },
        ],
      },
      {
        resourceSpecCode: "100ge",
        productSpecSysDesc: "PortType:100PCS",
        PortType: "100BSSUNIT.pluralUnit.41",
        planList: [
          { productId: "100ge-month", billingMode: "MONTHLY", periodNum: 1, amount: 11700 },
          { productId: "100ge-year-1", billingMode: "YEARLY", periodNum: 1, amount: 140400 },
          { productId: "100ge-year-2", billingMode: "YEARLY", periodNum: 2, amount: 280800 },
          { productId: "100ge-year-3", billingMode: "YEARLY", periodNum: 3, amount: 421200 },
        ],
      },
    ],
  },
} as const;

test("Direct Connect parser extracts port speeds and supported durations", () => {
  const catalog = parseDirectConnectPricingCatalogResponse(payload, "ap-southeast-1");
  expect(listDirectConnectPortSpeeds(catalog)).toEqual(["1GE", "10GE", "40GE", "100GE"]);
  expect(listDirectConnectDurationMonths(catalog, "1GE")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(listDirectConnectDurationMonths(catalog, "40GE")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 36]);
});

test("Direct Connect estimator uses direct monthly and yearly plans", () => {
  const catalog = parseDirectConnectPricingCatalogResponse(payload, "ap-southeast-1");

  expect(estimateDirectConnectConfiguration(catalog, { portSpeed: "1GE", durationMonths: 1, quantity: 1 })?.amount).toBe(116);
  expect(estimateDirectConnectConfiguration(catalog, { portSpeed: "100GE", durationMonths: 1, quantity: 1 })?.amount).toBe(11700);
  expect(estimateDirectConnectConfiguration(catalog, { portSpeed: "10GE", durationMonths: 2, quantity: 2 })?.amount).toBe(3940);
  expect(estimateDirectConnectConfiguration(catalog, { portSpeed: "40GE", durationMonths: 36, quantity: 1 })?.amount).toBe(198000);
});
