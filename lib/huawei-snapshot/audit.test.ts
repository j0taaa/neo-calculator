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
test("discounted fixed packages use independent quantity probes without inventing unsupported capacity", async () => {
  const s = scope();
  s.products.product.rows[0].planList = [
    { billingMode: "MONTHLY", amount: 357, periodNum: 1 },
  ];
  const q: Inquiry = {
    ...inquiry,
    chargingMode: 0,
    periodType: 2,
    productInfos: [
      {
        id: "package",
        cloudServiceType: "svc",
        resourceType: "resource",
        resourceSpecCode: "sku",
        productNum: 1,
      },
    ],
  };
  const quantities = new Set<number>();
  const gateway = new QuoteGateway(async (request) => {
    const p = request.productInfos[0];
    expect(p.resourceSize).toBeUndefined();
    quantities.add(p.productNum);
    const amount = 305 * p.productNum;
    return {
      amount,
      currency: "USD",
      productRatingResult: [{ id: p.id, amount }],
    };
  });
  expect((await compareInquiry(s, q, gateway)).calibrated).toBe(true);
  expect([...quantities].sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 7, 9999]);
  expect(
    rateInquiry(s, {
      ...q,
      productInfos: [{ ...q.productInfos[0], productNum: 11 }],
    }).amount,
  ).toBe(3355);
  const { verifyRecordedQuotes } = await import("./audit");
  expect(() => verifyRecordedQuotes(s)).not.toThrow();
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

test("learning a later rule cannot silently invalidate another recorded official response", async () => {
  const { verifyRecordedQuotes } = await import("./audit");
  const s = scope();
  s.proof = [
    {
      inquiry,
      response: {
        amount: 100,
        currency: "USD",
        productRatingResult: [{ id: "price", amount: 100 }],
      },
    },
  ];
  expect(() => verifyRecordedQuotes(s)).not.toThrow();
  s.ratingRules = {
    [ratingRuleKey(s, inquiry, inquiry.productInfos[0])]: {
      size: "multiply",
      multiplier: 2,
    },
  };
  expect(() => verifyRecordedQuotes(s)).toThrow("conflicts");
});

test("rounded Huawei VOD conversion rates are inferred from intervals and retain micro-units at large totals", async () => {
  const { Decimal } = await import("./decimal");
  const s = scope();
  s.products.product.rows[0].planList = [
    {
      billingMode: "ONDEMAND",
      measureUnit: 17,
      amount: 0.022,
      usageFactor: "vod_volume",
    },
  ];
  const q = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        resourceSize: undefined,
        productNum: 720,
        usageValue: 1,
        usageMeasureId: 48,
        usageFactor: "vod_volume",
      },
    ],
  };
  const gateway = new QuoteGateway(async (request) => {
    const product = request.productInfos[0];
    expect(product.productNum).toBeLessThanOrEqual(10000);
    const amount = Decimal.of("0.0000305556")
      .mul(product.productNum)
      .mul(product.usageValue!)
      .mul(1024 ** 2)
      .truncated(6);
    return {
      amount,
      currency: "USD",
      productRatingResult: [{ id: product.id, amount }],
    };
  });
  await compareInquiry(s, q, gateway);
  expect(rateInquiry(s, q).amount).toBe(23068.705554);
  expect(
    rateInquiry(s, {
      ...q,
      productInfos: [
        { ...q.productInfos[0], productNum: 9999, usageValue: 9999 },
      ],
    }).amount,
  ).toBe(3203346117.223356);
  const { verifyRecordedQuotes } = await import("./audit");
  expect(() => verifyRecordedQuotes(s)).not.toThrow();
  await compareInquiry(
    scopeWithPlan(),
    { ...q, productInfos: [{ ...q.productInfos[0], productNum: 9999 }] },
    gateway,
  );
  function scopeWithPlan() {
    const copy = scope();
    copy.products.product.rows[0].planList = structuredClone(
      s.products.product.rows[0].planList,
    );
    return copy;
  }
});

test("later calibration preserves earlier large quotes and micro-unit rounding", async () => {
  const { Decimal } = await import("./decimal");
  const { verifyRecordedQuotes } = await import("./audit");
  // SFS Turbo and partner Kafka expose rounded catalog rates at very different capacities.
  for (const [catalogRate, effectiveRate, size, hours, expected] of [
    ["0.0000559998", "0.0000559998", 1, 500, 0.027999],
    ["0.007", "0.000068985", 600, 1, 0.041391],
  ] as const) {
    const s = scope();
    s.ratingRuleVersion = 2;
    s.products.product.rows[0].planList![0].amount = Number(catalogRate);
    const gateway = new QuoteGateway(async (q) => {
      const p = q.productInfos[0];
      const amount = Decimal.of(effectiveRate).mul(p.productNum)
        .mul(Number(p.resourceSize)).mul(p.usageValue!).quantized(7).truncated(6);
      return { amount, currency: "USD", productRatingResult: [{ id: p.id, amount }] };
    });
    const first = { ...inquiry, productInfos: [{ ...inquiry.productInfos[0], resourceSize: size, usageValue: hours }] };
    await compareInquiry(s, { ...first, productInfos: [{ ...first.productInfos[0], usageValue: 0 }] }, gateway);
    await compareInquiry(s, first, gateway);
    expect(rateInquiry(s, first).amount).toBe(expected);
    await compareInquiry(s, { ...first, productInfos: [{ ...first.productInfos[0], resourceSize: 1, usageValue: 1 }] }, gateway);
    expect(rateInquiry(s, first).amount).toBe(expected);
    expect(() => verifyRecordedQuotes(s)).not.toThrow();
  }
});
