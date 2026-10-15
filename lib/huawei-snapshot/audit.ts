import { scaleFromRoundedQuotes } from "./rounding-scale";
import { supportPrice } from "./custom-pricing";
import { Decimal } from "./decimal";
import type { Inquiry } from "../huawei-native/types";
import { QuoteGateway, type InquiryResponse } from "../huawei-native/quotes";
import type { ScopeSnapshot } from "./types";
import { calibrateRecurring } from "./recurring";
import { rateInquiry, ratingRuleKey } from "./rating";
const equal = (a: number, b: number) => Math.abs(a - b) < 0.0000001;
export function quotesAgree(actual: InquiryResponse, official: InquiryResponse) {
  return equal(actual.amount, official.amount) &&
    actual.productRatingResult.length === official.productRatingResult.length &&
    official.productRatingResult.every((component) => {
      const item = actual.productRatingResult.find((item) => item.id === component.id);
      return !!item && equal(item.amount, component.amount) &&
        equal(Number(item.perAmount ?? 0), Number(component.perAmount ?? 0));
    });
}
export function verifyRecordedQuotes(scope: ScopeSnapshot) {
  for (const proof of scope.customProof ?? [])
    if (!equal(supportPrice(scope, proof.product, proof.months), proof.amount))
      throw new Error(
        "The synchronized custom pricing rule disagrees with the official calculator",
      );
  for (const { inquiry, response } of scope.proof ?? []) {
    const actual = rateInquiry(scope, inquiry);
    if (!quotesAgree(actual, response))
      throw new Error(
        `A learned pricing rule conflicts with another official response recorded in this audit: ${JSON.stringify({ inquiry, local: actual, official: response })}`,
      );
  }
}
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
  const quantity = product.productNum ?? 1;
  if (inquiry.chargingMode === 10)
    throw new Error("An RI rate disagrees with Huawei");
  const key = ratingRuleKey(scope, inquiry, product),
    rules = (scope.ratingRules ??= {});
  const scaledQuantity = (factor: number) =>
    quantity * factor <= 10000
      ? quantity * factor
      : Math.max(1, Math.floor(quantity / factor));
  const probes = [
    { ...product, id: "probe-1" },
    {
      ...product,
      id: "probe-2",
      productNum: scaledQuantity(3),
    },
    {
      ...product,
      id: "probe-3",
      ...(product.resourceSize !== undefined
        ? { resourceSize: Number(product.resourceSize) * 2 }
        : product.usageValue !== undefined
          ? { usageValue: product.usageValue * 3 }
          : { productNum: scaledQuantity(5) }),
    },
    {
      ...product,
      id: "probe-4",
      ...(product.usageValue !== undefined
        ? { usageValue: product.usageValue * 2 }
        : product.resourceSize !== undefined
          ? { resourceSize: 7 }
          : { productNum: scaledQuantity(7) }),
    },
  ];
  // A later SKU contract must preserve every earlier quote sharing this rule.
  // Compare individual components, since recorded inquiries may contain many SKUs.
  const cases = (scope.proof ?? []).flatMap(({ inquiry: request, response }) =>
    request.productInfos.flatMap((item) => {
      if (ratingRuleKey(scope, request, item) !== key) return [];
      const component = response.productRatingResult.find((p) => p.id === item.id);
      if (!component) throw new Error("Incomplete recorded Huawei quote");
      return [{ request: { ...request, productInfos: [item] }, response: {
        ...response, amount: component.amount, productRatingResult: [component],
      } }];
    }),
  );
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
        productNum: scaledQuantity(2),
        ...(product.resourceSize !== undefined
          ? { resourceSize: Number(product.resourceSize) * 7 }
          : {}),
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
    .flatMap(({ request, response }) => {
      const raw = rateInquiry(scope, request, false).exactAmount as {
        numerator: string;
        denominator: string;
      };
      const amount = Decimal.ratio(raw.numerator, raw.denominator);
      if (amount.numerator === BigInt(0)) return [];
      const ratio = Decimal.of(response.amount).div(amount);
      return [{
        numerator: String(ratio.numerator),
        denominator: String(ratio.denominator),
      }];
    })
    .filter(
      (scale) =>
        BigInt(scale.numerator) > BigInt(0) &&
        BigInt(scale.denominator) > BigInt(0),
    );
  for (const size of ["multiply", "ignore"] as const)
    for (const multiplier of multipliers)
      for (const rounding of ["floor", "round", "round7-floor6"] as const) {
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
      for (const rounding of ["floor", "round", "round7-floor6"] as const) {
        rules[key] = { size, multiplier: 1, scale, rounding };
        if (
          matchesHoldout() &&
          cases.every(({ request, response }) =>
            equal(rateInquiry(scope, request).amount, response.amount),
          )
        )
          return;
      }
  for (const size of ["multiply", "ignore"] as const)
    for (const rounding of ["floor", "round", "round7-floor6"] as const) {
      rules[key] = { size, multiplier: 1, rounding };
      const scale = scaleFromRoundedQuotes(
        scope,
        [...cases, { request: holdoutRequest, response: holdoutResponse }],
        rounding,
      );
      if (!scale) continue;
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
