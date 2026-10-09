import { test, expect } from "bun:test";
import { calculateQuote } from "./verify";
import { rateInquiry } from "./rating";
import type { ScopeSnapshot } from "./types";
import type { NativePricing } from "../huawei-native/native-pricing";
import type { Inquiry } from "../huawei-native/types";
const scope = {
  service: "ecs",
  region: "region-1",
  products: {
    product: {
      rows: [
        {
          resourceSpecCode: "spec",
          resourceType: "resource",
          cloudServiceType: "service",
          planList: [
            {
              billingMode: "ONDEMAND",
              amount: 2,
              measureUnit: 4,
              productId: "product",
            },
          ],
        },
      ],
    },
  },
} as unknown as ScopeSnapshot;
const pricing: NativePricing = {
  epoch: 1,
  pending: false,
  selectedProduct: {
    region: "region-1",
    serviceCode: "ecs",
    chargeMode: "ONDEMAND",
    timeTag: 1,
    periodNum: 1,
    periodType: 4,
    subscriptionNum: 1,
    productAllInfos: [
      {
        selectIndex: 0,
        resourceSpecCode: "spec",
        productNum: 2,
        inquiryTag: "normal",
        productId: "product",
      },
    ],
  },
  result: {
    amount: 0.01,
    timeTag: 1,
    productRatingResult: [{ id: "1-0-product", amount: 0.01 }],
  },
};
const inquiry: Inquiry = {
  regionId: "region-1",
  siteCode: "HWC",
  chargingMode: 1,
  periodNum: 1,
  periodType: 4,
  subscriptionNum: 1,
  productInfos: [
    {
      id: "1-0-product",
      cloudServiceType: "service",
      resourceType: "resource",
      resourceSpecCode: "spec",
      productNum: 2,
      usageFactor: "Duration",
      usageMeasureId: 4,
      usageValue: 720,
    },
  ],
};
test("saved amounts are rebuilt from rates even if all client totals were tampered with", () => {
  expect(
    calculateQuote(scope, "release", pricing, [inquiry]).quote.amount,
  ).toBe(2880);
  expect(() => calculateQuote(scope, "release", pricing, [])).toThrow(
    "Unsupported",
  );
  expect(() =>
    calculateQuote(scope, "release", pricing, [
      {
        ...inquiry,
        productInfos: [{ ...inquiry.productInfos[0], productNum: 1 }],
      },
    ]),
  ).toThrow("does not match");
});

test("priced resources with no selected product ID retain the actual inquiry component ID", () => {
  const p = structuredClone(pricing);
  delete p.selectedProduct.productAllInfos[0].productId;
  const q = structuredClone(inquiry);
  q.productInfos[0].id = "1-0-undefined";
  expect(calculateQuote(scope, "release", p, [q]).quote.amount).toBe(2880);
  q.productInfos[0].id = "1-0-noId";
  expect(() => calculateQuote(scope, "release", p, [q])).toThrow("Unsupported");
});
test("subscription prices truncate the combined resource charge, including quantity and duration", () => {
  const s = {
    ...scope,
    products: {
      product: {
        rows: [
          {
            resourceSpecCode: "spec",
            resourceType: "resource",
            cloudServiceType: "service",
            planList: [{ billingMode: "MONTHLY", amount: 0.899 }],
          },
        ],
      },
    },
    region: "region-1",
  };
  expect(
    rateInquiry(s, { ...inquiry, chargingMode: 0, periodType: 2 }).amount,
  ).toBe(1.79);
  expect(
    rateInquiry(s, { ...inquiry, chargingMode: 0, periodType: 2, periodNum: 2 })
      .amount,
  ).toBe(3.59);
});
