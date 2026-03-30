import { expect, test } from "bun:test";

import { estimateFunctionGraphConfiguration } from "@/lib/functiongraph-catalog";
import { parseFunctionGraphPricingCatalogResponse } from "@/lib/functiongraph-pricing";

const hongKongLikeFixture = {
  product: {
    functionstage_functionstage: [
      {
        planList: [
          {
            billingEvent: "event.type.functionstage.functionstage.request",
            divisionList: [
              { amount: 0, division: { beginValue: 0, endValue: 1 } },
              { amount: 0.28, division: { beginValue: 1, endValue: -1 } },
            ],
          },
        ],
      },
      {
        planList: [
          {
            billingEvent: "event.type.functionstage.functionstage.compute",
            divisionList: [
              { amount: 0, division: { beginValue: 0, endValue: 400000 } },
              { amount: 0.00002292, division: { beginValue: 400000, endValue: -1 } },
            ],
          },
        ],
      },
    ],
  },
};

test("FunctionGraph parser keeps the AP-Singapore override aligned with the documented rates", () => {
  const catalog = parseFunctionGraphPricingCatalogResponse(hongKongLikeFixture, "ap-southeast-1");

  expect(catalog.requestRatePerMillion).toBe(0.2);
  expect(catalog.computeRatePerGbSecond).toBe(0.00001667);
  expect(catalog.requestFreeCount).toBe(1_000_000);
  expect(catalog.computeFreeGbSeconds).toBe(400_000);
});

test("FunctionGraph parser keeps non-Singapore regions on the live catalog rates", () => {
  const catalog = parseFunctionGraphPricingCatalogResponse(hongKongLikeFixture, "cn-south-hongkong");

  expect(catalog.requestRatePerMillion).toBe(0.28);
  expect(catalog.computeRatePerGbSecond).toBe(0.00002292);
});

test("FunctionGraph estimator matches the documented examples", () => {
  const catalog = parseFunctionGraphPricingCatalogResponse(hongKongLikeFixture, "ap-southeast-1");

  const lowUsage = estimateFunctionGraphConfiguration(catalog, {
    averageRequestsAmount: 233,
    averageRequestsUnit: "month",
    executionDurationMs: 100,
    memoryAmount: 128,
    memoryUnit: "MB",
  });
  const mediumUsage = estimateFunctionGraphConfiguration(catalog, {
    averageRequestsAmount: 233,
    averageRequestsUnit: "day",
    executionDurationMs: 100,
    memoryAmount: 1024,
    memoryUnit: "MB",
  });
  const highMemory = estimateFunctionGraphConfiguration(catalog, {
    averageRequestsAmount: 233,
    averageRequestsUnit: "day",
    executionDurationMs: 100,
    memoryAmount: 10,
    memoryUnit: "GB",
  });
  const extremeWorkload = estimateFunctionGraphConfiguration(catalog, {
    averageRequestsAmount: 233,
    averageRequestsUnit: "hour",
    executionDurationMs: 300,
    memoryAmount: 1,
    memoryUnit: "GB",
  });

  expect(lowUsage?.amount).toBeCloseTo(0.27, 2);
  expect(mediumUsage?.amount).toBeCloseTo(123.64, 2);
  expect(highMemory?.amount).toBeCloseTo(1172.35, 2);
  expect(extremeWorkload?.amount).toBeCloseTo(8718.33, 2);
});
