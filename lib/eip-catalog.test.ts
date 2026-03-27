import { expect, test } from "bun:test";

import {
  estimateEipConfiguration,
  estimateEipTieredTrafficCost,
  selectEipTrafficPackageCombination,
  type EipPricingCatalog,
} from "@/lib/eip-catalog";
import { parseEipPricingCatalogResponse } from "@/lib/eip-pricing";

test("estimateEipTieredTrafficCost applies each usage tier in order", () => {
  const amount = estimateEipTieredTrafficCost([
    { startGb: 0, upToGb: 10, amountPerGb: 0.135 },
    { startGb: 10, upToGb: 50, amountPerGb: 0.124 },
    { startGb: 50, upToGb: 150, amountPerGb: 0.113 },
    { startGb: 150, upToGb: null, amountPerGb: 0.103 },
  ], 100);

  expect(amount).toBe(11.96);
});

test("selectEipTrafficPackageCombination chooses the lowest-cost combination", () => {
  const selection = selectEipTrafficPackageCombination([
    { billingMode: "MONTHLY", sizeGb: 10, amount: 2, resourceSpecCode: "pkg10", productId: null },
    { billingMode: "MONTHLY", sizeGb: 50, amount: 7, resourceSpecCode: "pkg50", productId: null },
    { billingMode: "MONTHLY", sizeGb: 100, amount: 8, resourceSpecCode: "pkg100", productId: null },
  ], 120);

  expect(selection).not.toBeNull();
  expect(selection?.amount).toBe(12);
  expect(selection?.items).toEqual([
    { sizeGb: 10, count: 2, amount: 4 },
    { sizeGb: 100, count: 1, amount: 8 },
  ]);
});

test("estimateEipConfiguration uses the dedicated flat traffic rate from the live catalog shape", () => {
  const catalog: EipPricingCatalog = {
    currency: "USD",
    regionId: "test-region",
    dedicated: {
      eipRates: { ONDEMAND: 0.005 },
      bandwidthRates: { ONDEMAND: 0.0281, MONTHLY: 9 },
      trafficRatePerGb: 0.135,
      trafficRateTiers: [
        { startGb: 0, upToGb: 10, amountPerGb: 0.135 },
        { startGb: 10, upToGb: 50, amountPerGb: 0.124 },
      ],
      trafficPackages: { MONTHLY: [], YEARLY: [] },
    },
    shared: {
      bandwidthRates: { ONDEMAND: 0.0281 },
      enhanced95MonthlyBaseRate: 20.25,
    },
  };

  const estimate = estimateEipConfiguration(catalog, {
    type: "Dedicated EIP",
    chargeMode: "By traffic",
    billingMode: "Pay-per-use",
    durationHours: 744,
    durationMonths: 1,
    bandwidthMbit: 0,
    sharedBandwidthQuantity: 1,
    trafficAmount: 100,
    trafficUnit: "GB",
  });

  expect(estimate).not.toBeNull();
  expect(estimate?.amount).toBe(17.22);
  expect(estimate?.breakdown).toEqual([
    { key: "eip", label: "EIP duration", amount: 3.72 },
    { key: "traffic", label: "Traffic", amount: 13.5 },
  ]);
});

test("estimateEipConfiguration applies shared bandwidth quantity and minimum size", () => {
  const catalog: EipPricingCatalog = {
    currency: "USD",
    regionId: "test-region",
    dedicated: {
      eipRates: { ONDEMAND: 0.005 },
      bandwidthRates: { ONDEMAND: 0.0281, MONTHLY: 9 },
      trafficRatePerGb: 0.135,
      trafficRateTiers: [],
      trafficPackages: { MONTHLY: [], YEARLY: [] },
    },
    shared: {
      bandwidthRates: { ONDEMAND: 0.0281 },
      enhanced95MonthlyBaseRate: 20.25,
    },
  };

  const estimate = estimateEipConfiguration(catalog, {
    type: "Shared EIP",
    chargeMode: "By bandwidth",
    billingMode: "Pay-per-use",
    durationHours: 744,
    durationMonths: 1,
    bandwidthMbit: 1,
    sharedBandwidthQuantity: 2,
    trafficAmount: 0,
    trafficUnit: "GB",
  });

  expect(estimate).not.toBeNull();
  expect(estimate?.amount).toBe(212.784);
});

test("estimateEipConfiguration prices enhanced 95 by month without hourly reservation charges", () => {
  const catalog: EipPricingCatalog = {
    currency: "USD",
    regionId: "test-region",
    dedicated: {
      eipRates: { ONDEMAND: 0.005 },
      bandwidthRates: { ONDEMAND: 0.0281, MONTHLY: 9 },
      trafficRatePerGb: 0.135,
      trafficRateTiers: [],
      trafficPackages: { MONTHLY: [], YEARLY: [] },
    },
    shared: {
      bandwidthRates: { ONDEMAND: 0.0281 },
      enhanced95MonthlyBaseRate: 20.25,
    },
  };

  const estimate = estimateEipConfiguration(catalog, {
    type: "Shared EIP",
    chargeMode: "Enhanced 95",
    billingMode: "Pay-per-use",
    durationHours: 744,
    durationMonths: 1,
    bandwidthMbit: 300,
    sharedBandwidthQuantity: 1,
    trafficAmount: 0,
    trafficUnit: "GB",
  });

  expect(estimate).not.toBeNull();
  expect(estimate?.amount).toBe(6075);
  expect(estimate?.suffix).toBe("/mo");
  expect(estimate?.breakdown).toEqual([
    { key: "enhanced95", label: "Enhanced 95", amount: 6075 },
  ]);
});

test("parseEipPricingCatalogResponse extracts dedicated and shared rate cards", () => {
  const catalog = parseEipPricingCatalogResponse({
    product: {
      vpc_ip: [
        {
          resourceSpecCode: "5_bgp",
          planList: [
            { billingMode: "ONDEMAND", amount: 0.005 },
            { billingMode: "MONTHLY", amount: 1.5 },
            { billingMode: "YEARLY", amount: 15 },
          ],
        },
      ],
      vpc_bandwidth: [
        {
          resourceSpecCode: "19_bgp",
          shareType: "dataInfo_3_",
          eipType: "dataInfo_5_",
          planList: [
            { billingMode: "ONDEMAND", amount: 0.0281 },
            { billingMode: "MONTHLY", amount: 9 },
            { billingMode: "YEARLY", amount: 90 },
          ],
        },
        {
          resourceSpecCode: "19_share",
          shareType: "dataInfo_4_",
          eipType: "dataInfo_5_",
          planList: [
            { billingMode: "ONDEMAND", amount: 0.0281 },
          ],
        },
        {
          resourceSpecCode: "19_share",
          shareType: "dataInfo_4_",
          eipType: "dataInfo_17_",
          planList: [
            { billingMode: "ONDEMAND", amount: 20.25 },
          ],
        },
        {
          resourceSpecCode: "12_bgp",
          shareType: "dataInfo_3_",
          planList: [
            {
              billingMode: "ONDEMAND",
              billingEvent: "event.type.bandwidthupflow",
              amount: 0.135,
              divisionList: [
                { amount: 0.135, division: { beginValue: 0, endValue: 10 } },
                { amount: 0.124, division: { beginValue: 10, endValue: 50 } },
              ],
            },
          ],
        },
        {
          resourceSpecCode: "12_bgp_100GB",
          shareType: "dataInfo_13_",
          planList: [
            { billingMode: "MONTHLY", productId: "pkg-100m", amount: 8 },
            { billingMode: "YEARLY", productId: "pkg-100y", amount: 80 },
          ],
        },
      ],
    },
  }, "ap-southeast-1");

  expect(catalog).toEqual({
    currency: "USD",
    regionId: "ap-southeast-1",
    dedicated: {
      eipRates: { ONDEMAND: 0.005, MONTHLY: 1.5, YEARLY: 15 },
      bandwidthRates: { ONDEMAND: 0.0281, MONTHLY: 9, YEARLY: 90 },
      trafficRatePerGb: 0.135,
      trafficRateTiers: [
        { startGb: 0, upToGb: 10, amountPerGb: 0.135 },
        { startGb: 10, upToGb: 50, amountPerGb: 0.124 },
      ],
      trafficPackages: {
        MONTHLY: [{ billingMode: "MONTHLY", sizeGb: 100, amount: 8, resourceSpecCode: "12_bgp_100GB", productId: "pkg-100m" }],
        YEARLY: [{ billingMode: "YEARLY", sizeGb: 100, amount: 80, resourceSpecCode: "12_bgp_100GB", productId: "pkg-100y" }],
      },
    },
    shared: {
      bandwidthRates: { ONDEMAND: 0.0281, MONTHLY: undefined, YEARLY: undefined },
      enhanced95MonthlyBaseRate: 20.25,
    },
  });
});
