import { Decimal } from "./decimal";
import type { Inquiry } from "../huawei-native/types";
import { QuoteGateway, type InquiryResponse } from "../huawei-native/quotes";
import type { ScopeSnapshot } from "./types";
import { calibrateRecurring } from "./recurring";
import { rateInquiry, ratingRuleKey } from "./rating";
const equal = (a: number, b: number) => Math.abs(a - b) < 0.0000001;
function remember(
  scope: ScopeSnapshot,
  inquiry: Inquiry,
  response: InquiryResponse,
) {
  (scope.proof ??= []).push({ inquiry, response });
}

/** Only bounded linear scale/size rules are learned; every candidate must pass independent probes. */
async function calibrate(
  scope: ScopeSnapshot,
  inquiry: Inquiry,
  index: number,
  gateway: QuoteGateway,
) {
  const product = inquiry.productInfos[index];
  if (inquiry.chargingMode === 10)
    throw new Error("An RI rate disagrees with Huawei");
  const key = ratingRuleKey(scope, inquiry, product),
    rules = (scope.ratingRules ??= {});
  const probes = [
    { ...product, id: "probe-1" },
    { ...product, id: "probe-2", productNum: product.productNum * 3 },
    {
      ...product,
      id: "probe-3",
      resourceSize: Number(product.resourceSize ?? 1) * 2,
    },
    {
      ...product,
      id: "probe-4",
      ...(product.usageValue !== undefined
        ? { usageValue: product.usageValue * 2 }
        : { resourceSize: 7 }),
    },
  ];
  const cases = [];
  for (const item of probes) {
    const request = { ...inquiry, productInfos: [item] },
      response = await gateway.inquire(request);
    remember(scope, request, response);
    cases.push({ request, response });
  }
  const holdoutRequest = {
    ...inquiry,
    productInfos: [
      {
        ...product,
        id: "holdout",
        productNum: product.productNum * 2,
        resourceSize: Number(product.resourceSize ?? 1) * 7,
        ...(product.usageValue !== undefined
          ? { usageValue: product.usageValue * 3 }
          : {}),
      },
    ],
  };
  const holdoutResponse = await gateway.inquire(holdoutRequest);
  remember(scope, holdoutRequest, holdoutResponse);
  const matchesHoldout = () =>
    equal(rateInquiry(scope, holdoutRequest).amount, holdoutResponse.amount);
  const precisionRequest = {
    ...inquiry,
    productInfos: [
      {
        ...product,
        id: "precision-probe",
        productNum: 9999,
        ...(product.usageValue !== undefined ? { usageValue: 9999 } : {}),
      },
    ],
  };
  const precisionResponse = await gateway.inquire(precisionRequest);
  remember(scope, precisionRequest, precisionResponse);
  cases.push({ request: precisionRequest, response: precisionResponse });
  const multipliers = [
    1,
    0.01,
    0.1,
    0.001,
    0.0001,
    0.000001,
    100,
    10,
    1000,
    1 / 1024,
    1024,
    1 / 720,
    1 / 730,
  ];
  // Catalog amounts sometimes omit the final significant digits of a linear rate.
  // Try an observed scale only when the independent probes also prove that same scale.
  delete rules[key];
  const scales = cases
    .map(({ request, response }) => {
      const raw = rateInquiry(scope, request, false).exactAmount as {
        numerator: string;
        denominator: string;
      };
      const ratio = Decimal.of(response.amount).div(
        Decimal.ratio(raw.numerator, raw.denominator),
      );
      return {
        numerator: String(ratio.numerator),
        denominator: String(ratio.denominator),
      };
    })
    .filter(
      (scale) =>
        BigInt(scale.numerator) > BigInt(0) &&
        BigInt(scale.denominator) > BigInt(0),
    );
  for (const size of ["multiply", "ignore"] as const)
    for (const multiplier of multipliers)
      for (const rounding of ["floor", "round"] as const) {
        rules[key] = { size, multiplier, rounding };
        if (
          matchesHoldout() &&
          cases.every(({ request, response }) =>
            equal(rateInquiry(scope, request).amount, response.amount),
          )
        )
          return;
      }
  for (const size of ["multiply", "ignore"] as const)
    for (const scale of scales)
      for (const rounding of ["floor", "round"] as const) {
        rules[key] = { size, multiplier: 1, scale, rounding };
        if (
          matchesHoldout() &&
          cases.every(({ request, response }) =>
            equal(rateInquiry(scope, request).amount, response.amount),
          )
        )
          return;
      }
  delete rules[key];
  throw new Error(
    `No validated local pricing rule for ${product.resourceSpecCode}; ${JSON.stringify(cases.map((c) => ({ request: c.request, amount: c.response.amount })))}`,
  );
}
export async function compareInquiry(
  scope: ScopeSnapshot,
  inquiry: Inquiry,
  gateway = new QuoteGateway(),
) {
  const official = await gateway.inquire(inquiry);
  remember(scope, inquiry, official);
  let local = rateInquiry(scope, inquiry),
    calibrated = false;
  for (let index = 0; index < local.productRatingResult.length; index++) {
    const item = local.productRatingResult[index],
      actual = official.productRatingResult.find((p) => p.id === item.id);
    if (!actual) throw new Error("Incomplete Huawei validation response");
    if (!equal(Number(item.perAmount ?? 0), Number(actual.perAmount ?? 0))) {
      await calibrateRecurring(scope, inquiry, index, gateway);
      calibrated = true;
      local = rateInquiry(scope, inquiry);
    }
    if (!equal(item.amount, actual.amount)) {
      await calibrate(scope, inquiry, index, gateway);
      calibrated = true;
      local = rateInquiry(scope, inquiry);
    }
  }
  if (!equal(local.amount, official.amount))
    throw new Error("The synchronized price does not match Huawei's total");
  for (const item of local.productRatingResult) {
    const actual = official.productRatingResult.find((p) => p.id === item.id)!;
    if (
      !equal(item.amount, actual.amount) ||
      !equal(Number(item.perAmount ?? 0), Number(actual.perAmount ?? 0))
    )
      throw new Error(
        `Price mismatch for ${inquiry.productInfos.find((p) => p.id === item.id)?.resourceSpecCode}: local ${JSON.stringify(item)}, official ${JSON.stringify(actual)}; ${JSON.stringify(inquiry)}`,
      );
  }
  return { checks: inquiry.productInfos.length, calibrated };
}
