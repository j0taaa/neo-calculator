import { test, expect } from "bun:test";
import { compareInquiry } from "./audit";
import { QuoteGateway } from "../huawei-native/quotes";
import { rateInquiry, ratingRuleKey } from "./rating";
import type { Inquiry } from "../huawei-native/types";
import type { ScopeSnapshot } from "./types";
import { applyRecurringOverrides } from "./recurring";
const inquiry: Inquiry = {
  regionId: "region",
  siteCode: "HWC",
  chargingMode: 1,
  periodType: 4,
  periodNum: 1,
  subscriptionNum: 1,
  productInfos: [
    {
      id: "price",
      cloudServiceType: "svc",
      resourceType: "resource",
      resourceSpecCode: "sku",
      productNum: 1,
      resourceSize: 5,
      usageFactor: "Duration",
      usageMeasureId: 4,
      usageValue: 2,
    },
  ],
};
function scope(): ScopeSnapshot {
  return {
    region: "region",
    products: {
      product: {
        rows: [
          {
            resourceSpecCode: "sku",
            resourceType: "resource",
            cloudServiceType: "svc",
            planList: [{ billingMode: "ONDEMAND", measureUnit: 4, amount: 10 }],
          },
        ],
      },
    },
  } as ScopeSnapshot;
}
test("linear size/scale calibration must pass changed quantity, size, duration and a holdout", async () => {
  const s = scope();
  let calls = 0;
  const gateway = new QuoteGateway(async (q) => {
    calls++;
    const p = q.productInfos[0],
      amount = 0.1 * p.productNum * p.usageValue!;
    return {
      amount,
      currency: "USD",
      productRatingResult: [{ id: p.id, amount }],
    };
  });
  await compareInquiry(s, inquiry, gateway);
  expect(calls).toBe(7);
  expect(
    rateInquiry(s, {
      ...inquiry,
      productInfos: [
        {
          ...inquiry.productInfos[0],
          resourceSize: 70,
          productNum: 8,
          usageValue: 7,
        },
      ],
    }).amount,
  ).toBe(5.6);
});
test("unsupported nonlinear rules are rejected rather than fitted to a few defaults", async () => {
  const s = scope();
  const gateway = new QuoteGateway(async (q) => {
    const p = q.productInfos[0],
      amount = p.productNum === 2 ? 999 : 0.1 * p.productNum * p.usageValue!;
    return {
      amount,
      currency: "USD",
      productRatingResult: [{ id: p.id, amount }],
    };
  });
  await expect(compareInquiry(s, inquiry, gateway)).rejects.toThrow(
    "No validated local pricing rule",
  );
  expect(Object.keys(s.ratingRules ?? {})).toHaveLength(0);
});
test("RI recurring corrections are validated and isolated by reservation term", async () => {
  const s = scope();
  s.products.product.rows = [1, 3].map((term) => ({
    cloudServiceType: "svc",
    resourceType: "resource",
    resourceSpecCode: "sku",
    RITime: `nodeData.${term}_3`,
    planList: [
      {
        billingMode: "RI",
        originType: "price",
        amount: 0,
        productId: "id",
        skuCode: "code",
      },
      {
        billingMode: "RI",
        originType: "perEffectivePrice",
        amount: 1,
        productId: "id",
        skuCode: "code",
      },
      {
        billingMode: "RI",
        originType: "perPrice",
        amount: 730,
        productId: "id",
        skuCode: "code",
      },
    ],
  }));
  const q = {
    ...inquiry,
    chargingMode: 10,
    periodType: 3,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        resourceSize: undefined,
        productId: "id",
        skuCode: "code",
      },
    ],
  };
  const gateway = new QuoteGateway(async (r) => ({
    amount: 0,
    currency: "USD",
    productRatingResult: r.productInfos.map((p) => ({
      id: p.id,
      amount: 0,
      perAmount: 3.823 * p.productNum,
      perPeriodType: 4,
    })),
  }));
  await compareInquiry(s, q, gateway);
  expect(rateInquiry(s, q).perAmount).toBe(3.823);
  expect(s.products.product.rows[0].planList![2].amount).toBe(2790.79);
  expect(rateInquiry(s, { ...q, periodNum: 3 }).perAmount).toBe(1);
  expect(ratingRuleKey(s, q, q.productInfos[0])).not.toBe(
    ratingRuleKey(s, { ...q, periodNum: 3 }, q.productInfos[0]),
  );
  const fresh = structuredClone(s);
  fresh.products.product.rows[0].planList![1].amount = 1;
  applyRecurringOverrides(fresh);
  expect(rateInquiry(fresh, q).perAmount).toBe(3.823);
});
