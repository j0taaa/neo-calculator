import { test, expect } from "bun:test";
import { rateInquiry, convert, ratingRuleKey } from "./rating";
import type { Inquiry } from "../huawei-native/types";
import type { ScopeSnapshot, Plan } from "./types";
const inquiry: Inquiry = {
  regionId: "region-1",
  siteCode: "HWC",
  chargingMode: 1,
  periodNum: 1,
  periodType: 4,
  subscriptionNum: 1,
  productInfos: [
    {
      id: "resource",
      cloudServiceType: "service",
      resourceType: "resource",
      resourceSpecCode: "spec",
      productNum: 2,
      resourceSize: 40,
      usageFactor: "Duration",
      usageMeasureId: 4,
      usageValue: 720,
    },
  ],
};
function scope(plans: Plan[], extra = {}) {
  return {
    region: "region-1",
    products: {
      product: {
        rows: [
          {
            resourceSpecCode: "spec",
            resourceType: "resource",
            cloudServiceType: "service",
            planList: plans,
            ...extra,
          },
        ],
      },
    },
  } as unknown as ScopeSnapshot;
}
test("local rates convert duration units and account for size and quantity", () => {
  expect(
    rateInquiry(
      scope([{ billingMode: "ONDEMAND", amount: 0.1, measureUnit: 0 }]),
      inquiry,
    ).amount,
  ).toBe(240);
  expect(
    rateInquiry(
      scope([{ billingMode: "ONDEMAND", amount: 0.1, measureUnit: 4 }]),
      inquiry,
    ).amount,
  ).toBe(5760);
  expect(convert(3600, 6, 4)).toBe(1);
  expect(() => convert(1, 14, 4)).toThrow("conversion");
});
test("progressive and whole-quantity tiers are different", () => {
  const plan: Plan = {
    billingMode: "ONDEMAND",
    divisionType: "DIVISION_STEP",
    divisionList: [
      { amount: 1, division: { beginValue: 0, endValue: 5 } },
      { amount: 3, division: { beginValue: 5, endValue: -1 } },
    ],
  };
  const q = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        productNum: 1,
        resourceSize: 8,
        usageValue: 1,
      },
    ],
  };
  expect(rateInquiry(scope([plan]), q).amount).toBe(14);
  expect(
    rateInquiry(scope([{ ...plan, divisionType: "DIVISION_TIER" }]), q).amount,
  ).toBe(24);
});
test("yearly rates and RI upfront/effective rates preserve their billing semantics", () => {
  const q = {
    ...inquiry,
    chargingMode: 0,
    periodNum: 3,
    periodType: 3,
    productInfos: [{ ...inquiry.productInfos[0], resourceSize: 1 }],
  };
  expect(
    rateInquiry(
      scope([
        { billingMode: "YEARLY", amount: 100, periodNum: 1 },
        { billingMode: "YEARLY", amount: 250, periodNum: 3 },
      ]),
      q,
    ).amount,
  ).toBe(500);
  const ri = { ...q, chargingMode: 10, periodNum: 1 };
  const result = rateInquiry(
    scope(
      [
        { billingMode: "RI", originType: "price", amount: 100 },
        { billingMode: "RI", originType: "perEffectivePrice", amount: 0.01 },
      ],
      { RITime: "nodeData.1_3" },
    ),
    ri,
  );
  expect(result.amount).toBe(200);
  expect(result.perAmount).toBe(0.02);
});
test("unknown rates, conditions, malformed quantities and cross-region requests fail closed", () => {
  const s = scope([
    { billingMode: "ONDEMAND", amount: 1, condition: "new rule" },
  ]);
  expect(() => rateInquiry(s, inquiry)).toThrow("conditional");
  expect(() => rateInquiry(s, { ...inquiry, regionId: "other" })).toThrow(
    "scope",
  );
  expect(() =>
    rateInquiry(s, {
      ...inquiry,
      productInfos: [{ ...inquiry.productInfos[0], productNum: -1 }],
    }),
  ).toThrow("quantity");
  expect(() => rateInquiry(scope([]), inquiry)).toThrow("No synchronized rate");
});
test("decimal truncation preserves large tier charges and exact repeated currency amounts", () => {
  const plan: Plan = {
    billingMode: "ONDEMAND",
    divisionType: "DIVISION_STEP",
    divisionList: [
      {
        amount: 0.135,
        division: { beginValue: 0, endValue: 10, beginUnit: 9 },
      },
      {
        amount: 0.124,
        division: { beginValue: 10, endValue: 50, beginUnit: 9 },
      },
      {
        amount: 0.113,
        division: { beginValue: 50, endValue: 150, beginUnit: 9 },
      },
      {
        amount: 0.103,
        division: { beginValue: 150, endValue: -1, beginUnit: 9 },
      },
    ],
  };
  const s = scope([plan]),
    q = {
      ...inquiry,
      productInfos: [
        {
          ...inquiry.productInfos[0],
          resourceSize: 1,
          usageFactor: "traffic",
          usageMeasureId: 8,
          usageValue: 1,
          productNum: 1,
        },
      ],
    };
  s.ratingRules = {
    [ratingRuleKey(s, q, q.productInfos[0])]: {
      size: "ignore",
      multiplier: 1024,
    },
  };
  expect(rateInquiry(s, q).amount).toBe(110215.168);
});

test("duration is determined by units even when the usage factor is named count", () => {
  const s = scope([
    { billingMode: "ONDEMAND", amount: 0.2408, measureUnit: 4 },
  ]);
  const q = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        productNum: 1,
        resourceSize: 3,
        usageFactor: "count",
        usageMeasureId: 4,
        usageValue: 1,
      },
    ],
  };
  expect(rateInquiry(s, q).amount).toBe(0.7224);
});
