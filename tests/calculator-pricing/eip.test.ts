import { expect, test } from "bun:test";

import { estimateEipConfiguration, type EipPricingCatalog } from "@/lib/eip-catalog";

const catalog: EipPricingCatalog = {
  currency: "USD",
  regionId: "sa-brazil-1",
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

test("EIP price calculations stay aligned for key billing modes", () => {
  expect(
    estimateEipConfiguration(catalog, {
      type: "Dedicated EIP",
      chargeMode: "By traffic",
      billingMode: "Pay-per-use",
      durationHours: 744,
      durationMonths: 1,
      bandwidthMbit: 0,
      sharedBandwidthQuantity: 1,
      trafficAmount: 100,
      trafficUnit: "GB",
    })?.amount,
  ).toBe(17.22);

  expect(
    estimateEipConfiguration(catalog, {
      type: "Shared EIP",
      chargeMode: "By bandwidth",
      billingMode: "Pay-per-use",
      durationHours: 744,
      durationMonths: 1,
      bandwidthMbit: 1,
      sharedBandwidthQuantity: 2,
      trafficAmount: 0,
      trafficUnit: "GB",
    })?.amount,
  ).toBe(212.784);

  expect(
    estimateEipConfiguration(catalog, {
      type: "Shared EIP",
      chargeMode: "Enhanced 95",
      billingMode: "Pay-per-use",
      durationHours: 744,
      durationMonths: 1,
      bandwidthMbit: 300,
      sharedBandwidthQuantity: 1,
      trafficAmount: 0,
      trafficUnit: "GB",
    })?.amount,
  ).toBe(6075);
});
