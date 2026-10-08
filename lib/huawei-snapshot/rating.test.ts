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
test("identical regional SKUs use the selected availability zone's price and independent correction key", () => {
  const s = scope([{ billingMode: "ONDEMAND", amount: 1, measureUnit: 4 }]);
  s.ratingRuleVersion = 2;
  s.products.product.rows.push({
    ...s.products.product.rows[0],
    locationCode: "lagos",
    planList: [{ billingMode: "ONDEMAND", amount: 2, measureUnit: 4 }],
  });
  const q = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        resourceSize: 1,
        productNum: 1,
        usageValue: 1,
      },
    ],
  };
  const zone = { ...q, availableZoneId: "lagos" };
  expect(rateInquiry(s, q).amount).toBe(1);
  expect(rateInquiry(s, zone).amount).toBe(2);
  expect(ratingRuleKey(s, q, q.productInfos[0])).not.toBe(
    ratingRuleKey(s, zone, zone.productInfos[0]),
  );
  expect(() => rateInquiry(s, { ...q, availableZoneId: "unknown" })).toThrow(
    "No synchronized rate",
  );
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

test("official OBS and SFS Turbo responses use verified seven-decimal quantization before six-decimal truncation", () => {
  const s = scope([
    { billingMode: "ONDEMAND", amount: 0.00016157, measureUnit: 4 },
  ]);
  const request = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        productNum: 1,
        resourceSize: 1228,
        usageValue: 1,
      },
    ],
  };
  s.ratingRules = {
    [ratingRuleKey(s, request, request.productInfos[0])]: {
      size: "multiply",
      multiplier: 1,
      rounding: "round7-floor6",
    },
  };
  for (const [quantity, expected] of [
    [1, 0.198408],
    [2, 0.396815],
    [3, 0.595223],
    [4, 0.793631],
    [5, 0.992039],
    [6, 1.190447],
    [7, 1.388855],
    [8, 1.587263],
    [9, 1.785671],
    [10, 1.984079],
    [9999, 1983.881192],
  ])
    expect(
      rateInquiry(s, {
        ...request,
        productInfos: [{ ...request.productInfos[0], productNum: quantity }],
      }).amount,
    ).toBe(expected);
  expect(
    rateInquiry(s, {
      ...request,
      productInfos: [
        { ...request.productInfos[0], productNum: 9999, usageValue: 9999 },
      ],
    }).amount,
  ).toBe(19836828.039208);
  const obs = scope([
    { billingMode: "ONDEMAND", amount: 0.0000347222, measureUnit: 17 },
  ]);
  const storage = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        productNum: 720,
        resourceSize: undefined,
        usageFactor: "size_3az",
        usageMeasureId: 17,
        usageValue: 1,
      },
    ],
  };
  obs.ratingRules = {
    [ratingRuleKey(obs, storage, storage.productInfos[0])]: {
      size: "ignore",
      multiplier: 1,
      rounding: "round7-floor6",
    },
  };
  expect(rateInquiry(obs, storage).amount).toBe(0.025);
  expect(
    rateInquiry(obs, {
      ...storage,
      productInfos: [
        { ...storage.productInfos[0], productNum: 9999, usageValue: 9999 },
      ],
    }).amount,
  ).toBe(3471.52559);
});

test("identical resource codes at different billing sites use the requested site plan", () => {
  const s = scope([
    { billingMode: "ONDEMAND", amount: 1, measureUnit: 4, siteCode: "HWC" },
    {
      billingMode: "ONDEMAND",
      amount: 3.4274,
      measureUnit: 4,
      siteCode: "ALLY_FLEXIBLEENGINE",
    },
  ]);
  const q = {
    ...inquiry,
    siteCode: "ALLY_FLEXIBLEENGINE",
    productInfos: [
      {
        ...inquiry.productInfos[0],
        productNum: 1,
        resourceSize: 1,
        usageValue: 1,
      },
    ],
  };
  expect(rateInquiry(s, q).amount).toBe(3.4274);
  expect(rateInquiry(s, { ...q, siteCode: "HWC" }).amount).toBe(1);
});

test("MaaS converts the official million-token input into thousand-token rates", () => {
  const s = scope([
    {
      billingMode: "ONDEMAND",
      amount: 0.000135,
      measureUnit: 109,
      usageFactor: "input",
    },
  ]);
  const q = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        resourceSize: undefined,
        productNum: 1,
        usageFactor: "input",
        usageMeasureId: 111,
        usageValue: 1,
      },
    ],
  };
  expect(rateInquiry(s, q).amount).toBe(0.135);
  expect(
    rateInquiry(s, {
      ...q,
      productInfos: [{ ...q.productInfos[0], usageValue: 1000000 }],
    }).amount,
  ).toBe(135000);
  expect(() =>
    rateInquiry(s, {
      ...q,
      productInfos: [{ ...q.productInfos[0], productNum: 10001 }],
    }),
  ).toThrow("calculation limit");
});

test("new corrections are isolated by input units and billing site while old saved releases retain their key format", () => {
  const s = scope([{ billingMode: "ONDEMAND", amount: 1, measureUnit: 17 }]);
  const q = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        productNum: 1,
        usageFactor: "size",
        usageMeasureId: 17,
        usageValue: 2,
      },
    ],
  };
  const oldKey = ratingRuleKey(s, q, q.productInfos[0]);
  s.ratingRuleVersion = 2;
  const newKey = ratingRuleKey(s, q, q.productInfos[0]);
  expect(newKey).not.toBe(oldKey);
  expect(
    ratingRuleKey(s, q, { ...q.productInfos[0], usageMeasureId: 48 }),
  ).not.toBe(newKey);
  delete s.ratingRuleVersion;
  s.ratingRules = { [oldKey]: { size: "ignore", multiplier: 0.5 } };
  expect(rateInquiry(s, q).amount).toBe(1);
});

test("CBC's observed null quantity default is preserved for CDN traffic", () => {
  const s = scope([
    {
      billingMode: "ONDEMAND",
      amount: 0.115,
      measureUnit: 10,
      usageFactor: "traffic.overseas",
    },
  ]);
  const q = {
    ...inquiry,
    productInfos: [
      {
        ...inquiry.productInfos[0],
        productNum: null,
        resourceSize: undefined,
        usageFactor: "traffic.overseas",
        usageMeasureId: 10,
        usageValue: 1,
      },
    ],
  } as unknown as Inquiry;
  expect(rateInquiry(s, q).amount).toBe(0.115);
  expect(
    rateInquiry(s, {
      ...q,
      productInfos: [{ ...q.productInfos[0], productNum: 1 }],
    }).amount,
  ).toBe(0.115);
});

test("CDN tier ranges normalize TB/PB boundaries before applying the verified per-GB scale", () => {
  const s = scope([
    {
      billingMode: "ONDEMAND",
      divisionType: "DIVISION_STEP",
      usageFactor: "traffic.overseas",
      divisionList: [
        {
          amount: 0.115,
          division: { beginValue: 0, endValue: 10, beginUnit: 9, endUnit: 9 },
        },
        {
          amount: 0.11,
          division: { beginValue: 10, endValue: 50, beginUnit: 9, endUnit: 9 },
        },
        {
          amount: 0.095,
          division: { beginValue: 50, endValue: 100, beginUnit: 9, endUnit: 9 },
        },
        {
          amount: 0.076,
          division: { beginValue: 100, endValue: 1, beginUnit: 9, endUnit: 8 },
        },
        {
          amount: 0.067,
          division: { beginValue: 1, endValue: -1, beginUnit: 8, endUnit: 8 },
        },
      ],
    },
  ]);
  s.ratingRuleVersion = 2;
  for (const [unit, usage, official] of [
    [10, 1, 0.115],
    [9, 10, 1177.6],
    [9, 20, 2304],
    [9, 100, 10547.2],
    [8, 1, 82456.576],
    [8, 2, 152711.168],
    [10, 9999, 1149.885],
  ]) {
    const q = {
      ...inquiry,
      productInfos: [
        {
          ...inquiry.productInfos[0],
          productNum: 1,
          usageFactor: "traffic.overseas",
          usageMeasureId: unit,
          usageValue: usage,
        },
      ],
    };
    s.ratingRules = {
      [ratingRuleKey(s, q, q.productInfos[0])]: {
        size: "ignore",
        multiplier: 1024,
        rounding: "floor",
      },
    };
    expect(rateInquiry(s, q).amount).toBe(official);
  }
});
