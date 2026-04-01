import { expect, test } from "bun:test";

import { estimateFunctionGraphConfiguration, type FunctionGraphPricingCatalog } from "@/lib/functiongraph-catalog";

const catalog: FunctionGraphPricingCatalog = {
  currency: "USD",
  regionId: "ap-southeast-1",
  requestFreeCount: 1_000_000,
  requestRatePerMillion: 0.2,
  computeFreeGbSeconds: 400_000,
  computeRatePerGbSecond: 0.00001667,
  requestTiers: [
    { start: 0, end: 1_000_000, amount: 0 },
    { start: 1_000_000, end: null, amount: 0.2 },
  ],
  computeTiers: [
    { start: 0, end: 400_000, amount: 0 },
    { start: 400_000, end: null, amount: 0.00001667 },
  ],
};

test("FunctionGraph documented examples stay aligned", () => {
  expect(
    estimateFunctionGraphConfiguration(catalog, {
      averageRequestsAmount: 233,
      averageRequestsUnit: "month",
      executionDurationMs: 100,
      memoryAmount: 128,
      memoryUnit: "MB",
    })?.amount,
  ).toBeCloseTo(0.27, 2);

  expect(
    estimateFunctionGraphConfiguration(catalog, {
      averageRequestsAmount: 233,
      averageRequestsUnit: "day",
      executionDurationMs: 100,
      memoryAmount: 1024,
      memoryUnit: "MB",
    })?.amount,
  ).toBeCloseTo(123.64, 2);

  expect(
    estimateFunctionGraphConfiguration(catalog, {
      averageRequestsAmount: 233,
      averageRequestsUnit: "day",
      executionDurationMs: 100,
      memoryAmount: 10,
      memoryUnit: "GB",
    })?.amount,
  ).toBeCloseTo(1172.35, 2);

  expect(
    estimateFunctionGraphConfiguration(catalog, {
      averageRequestsAmount: 233,
      averageRequestsUnit: "hour",
      executionDurationMs: 300,
      memoryAmount: 1,
      memoryUnit: "GB",
    })?.amount,
  ).toBeCloseTo(8718.33, 2);
});
