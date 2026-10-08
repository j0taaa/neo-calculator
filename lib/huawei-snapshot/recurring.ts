import { Decimal } from "./decimal";
import {
  catalogRows,
  matchingPlans,
  ratingRuleKey,
  planRuleKey,
  rateInquiry,
} from "./rating";
import type { ScopeSnapshot } from "./types";
import type { Inquiry } from "../huawei-native/types";
import { QuoteGateway } from "../huawei-native/quotes";
/** RI catalogs occasionally lag the inquiry API. Only verified hourly recurring rates are normalized. */
export async function calibrateRecurring(
  scope: ScopeSnapshot,
  inquiry: Inquiry,
  index: number,
  gateway: QuoteGateway,
) {
  if (inquiry.chargingMode !== 10)
    throw new Error("Unsupported recurring rate normalization");
  const product = inquiry.productInfos[index],
    plans = matchingPlans(catalogRows(scope), inquiry, product);
  if (!plans.some(({ plan }) => plan.originType === "perPrice"))
    throw new Error("Missing RI monthly payment plan");
  const cases = [];
  for (const quantity of [1, 2, 3]) {
    const request = {
        ...inquiry,
        productInfos: [
          { ...product, id: "recurring-probe", productNum: quantity },
        ],
      },
      response = await gateway.inquire(request);
    (scope.proof ??= []).push({ inquiry: request, response });
    cases.push({ request, response });
  }
  const hourly = Number(cases[0].response.productRatingResult[0].perAmount);
  if (
    !Number.isFinite(hourly) ||
    hourly < 0 ||
    cases.some(
      ({ response }) =>
        Number(response.productRatingResult[0].perPeriodType) !== 4,
    )
  )
    throw new Error("Unrecognized RI recurring units");
  for (const { request, response } of cases) {
    const actual = response.productRatingResult[0],
      local = rateInquiry(scope, request).productRatingResult[0];
    if (
      Math.abs(local.amount - actual.amount) > 0.0000001 ||
      Math.abs(
        hourly * request.productInfos[0].productNum - Number(actual.perAmount),
      ) > 0.0000001
    )
      throw new Error("The RI rate is not a verified linear recurring price");
  }
  // Huawei's RI plans express installments per month using 8760 hours / 12.
  const key = ratingRuleKey(scope, inquiry, product);
  (scope.ratingRules ??= {})[key] = {
    size: "multiply",
    multiplier: 1,
    recurring: { hourly, monthly: Decimal.of(hourly).mul(730).truncated(2) },
  };
  applyRecurringOverrides(scope);
}
export function applyRecurringOverrides(scope: ScopeSnapshot) {
  for (const row of catalogRows(scope))
    if (row.RITime) {
      const [periodNum, periodType] = row.RITime.replace("nodeData.", "")
        .split("_")
        .map(Number);
      for (const upfront of row.planList ?? [])
        if (upfront.originType === "price") {
          const request = {
            regionId: scope.region,
            siteCode: upfront.siteCode ?? "HWC",
            ...(typeof row.locationCode === "string" && row.locationCode
              ? { availableZoneId: row.locationCode }
              : {}),
            chargingMode: 10,
            periodNum,
            periodType,
            subscriptionNum: 1,
            productInfos: [
              {
                id: "override",
                cloudServiceType: row.cloudServiceType,
                resourceType: row.resourceType,
                resourceSpecCode: row.resourceSpecCode,
                productNum: 1,
                productId: upfront.productId,
                skuCode: upfront.skuCode,
              },
            ],
          };
          const override =
            scope.ratingRules?.[
              planRuleKey(
                request,
                request.productInfos[0],
                upfront,
                scope.ratingRuleVersion ?? 1,
              )
            ]?.recurring;
          if (!override) continue;
          for (const plan of row.planList ?? [])
            if (
              plan.productId === upfront.productId &&
              plan.skuCode === upfront.skuCode
            ) {
              if (plan.originType === "perEffectivePrice")
                plan.amount = override.hourly;
              if (plan.originType === "perPrice")
                plan.amount = override.monthly;
            }
        }
    }
}
