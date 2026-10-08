import { test, expect } from "bun:test";
import { declaredCapacityMeasure, validateCatalogContracts } from "./contracts";
import { QuoteGateway } from "../huawei-native/quotes";
import type { ScopeSnapshot, CatalogProduct } from "./types";
const row = {
  cloudServiceType: "svc",
  resourceType: "pool",
  resourceSpecCode: "variable",
  capacity: "nullBSSUNIT.unit.14",
  planList: [
    {
      billingMode: "MONTHLY",
      amount: 59.94,
      periodNum: 1,
      productId: "variable-id",
      siteCode: "HWC",
      billingEvent: "event.type.onetime",
    },
  ],
} as CatalogProduct;
test("capacity measure comes from explicit catalog metadata, with ambiguous or fixed dimensions rejected", () => {
  expect(declaredCapacityMeasure(row)).toBe(14);
  expect(
    declaredCapacityMeasure({ ...row, other: "nullBSSUNIT.unit.17" }),
  ).toBeUndefined();
  expect(
    declaredCapacityMeasure({ ...row, capacity: "100BSSUNIT.unit.14" }),
  ).toBeUndefined();
});
test("catalog contracts preserve fixed packages and send the declared unit for variable capacity", async () => {
  const fixed = {
    ...row,
    resourceSpecCode: "fixed",
    capacity: "80000 CUH",
    planList: [{ ...row.planList![0], productId: "fixed-id", amount: 6290 }],
  };
  const inquiry = {
    regionId: "region",
    chargingMode: 0,
    periodType: 2,
    periodNum: 1,
    subscriptionNum: 1,
    siteCode: "HWC",
    productInfos: [
      {
        id: "template",
        cloudServiceType: "svc",
        resourceType: "pool",
        resourceSpecCode: "fixed",
        productNum: 1,
        productId: "fixed-id",
      },
    ],
  };
  const scope = {
    region: "region",
    products: { product: { rows: [fixed, row] } },
    proof: [
      {
        inquiry,
        response: {
          amount: 6290,
          currency: "USD",
          productRatingResult: [{ id: "template", amount: 6290 }],
        },
      },
    ],
  } as unknown as ScopeSnapshot;
  const requests: unknown[] = [];
  const gateway = new QuoteGateway(async (q) => {
    requests.push(q);
    for (const p of q.productInfos)
      if (p.resourceSpecCode === "variable") {
        expect(p.resourceSize).toBe(1);
        expect(p.resouceSizeMeasureId).toBe(14);
      } else expect(p.resourceSize).toBeUndefined();
    const components = q.productInfos.map((p) => ({
      id: p.id,
      amount: p.resourceSpecCode === "variable" ? 59.94 : 6290,
    }));
    return {
      amount: components.reduce((s, p) => s + p.amount, 0),
      currency: "USD",
      productRatingResult: components,
    };
  });
  expect(await validateCatalogContracts(scope, gateway)).toBe(2);
  expect(requests).toHaveLength(1);
});
test("catalog audits independently verify both monthly discount thresholds instead of deduplicating their terms", async () => {
  const packageRow = {
    ...row,
    capacity: "fixed",
    planList: [
      { ...row.planList![0], amount: 305, periodNum: 1 },
      { ...row.planList![0], amount: 1525, periodNum: 6 },
    ],
  };
  const inquiry = {
    regionId: "region", siteCode: "HWC", chargingMode: 0, periodType: 2,
    periodNum: 1, subscriptionNum: 1,
    productInfos: [{ id: "template", cloudServiceType: "svc", resourceType: "pool",
      resourceSpecCode: "variable", productNum: 1, productId: "variable-id" }],
  };
  const scope = {
    region: "region", ratingRuleVersion: 2,
    products: { product: { rows: [packageRow] } },
    proof: [{ inquiry, response: { amount: 305, currency: "USD", productRatingResult: [{ id: "template", amount: 305 }] } }],
  } as unknown as ScopeSnapshot;
  const periods: number[] = [];
  const gateway = new QuoteGateway(async request => {
    periods.push(request.periodNum);
    const amount = request.periodNum === 6 ? 1525 : 305;
    return { amount, currency: "USD", productRatingResult: request.productInfos.map(product => ({ id: product.id, amount })) };
  });
  expect(await validateCatalogContracts(scope, gateway)).toBe(2);
  expect(periods).toEqual([1, 6]);
});
