import { expect, test } from "bun:test";
import { revalidateUnchangedScope, PricingChanged } from "./revalidate";
import { QuoteGateway } from "../huawei-native/quotes";
import type { Inquiry } from "../huawei-native/types";
import type { ScopeSnapshot } from "./types";
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
      usageFactor: "duration",
      usageMeasureId: 4,
      usageValue: 1,
    },
  ],
};
const response = (request: Inquiry, rate = 1) => ({
  amount: request.productInfos[0].productNum * rate,
  currency: "USD",
  productRatingResult: [
    {
      id: request.productInfos[0].id,
      amount: request.productInfos[0].productNum * rate,
    },
  ],
});
const snapshot = () =>
  ({
    region: "region",
    products: {
      product: {
        rows: [
          {
            cloudServiceType: "svc",
            resourceType: "resource",
            resourceSpecCode: "sku",
            planList: [{ billingMode: "ONDEMAND", measureUnit: 4, amount: 1 }],
          },
        ],
      },
    },
    proof: [{ inquiry, response: response(inquiry) }],
  }) as unknown as ScopeSnapshot;
test("unchanged sources get fresh price checks while retaining bounded validation shapes", async () => {
  const old = snapshot(),
    fresh = snapshot();
  let requests = 0;
  expect(
    await revalidateUnchangedScope(
      fresh,
      old,
      new QuoteGateway(async (request) => {
        requests++;
        return response(request);
      }),
    ),
  ).toBe(1);
  expect(requests).toBe(1);
  expect(fresh.proof).toEqual(old.proof);
});
test("API prices changing under unchanged catalog metadata trigger a complete audit", async () => {
  const old = snapshot(),
    fresh = snapshot();
  await expect(
    revalidateUnchangedScope(
      fresh,
      old,
      new QuoteGateway(async (request) => ({
        amount:
          2 *
          request.productInfos[0].productNum *
          (request.productInfos[0].usageValue ?? 1),
        currency: "USD",
        productRatingResult: [
          {
            id: request.productInfos[0].id,
            amount:
              2 *
              request.productInfos[0].productNum *
              (request.productInfos[0].usageValue ?? 1),
          },
        ],
      })),
    ),
  ).rejects.toBeInstanceOf(PricingChanged);
});
