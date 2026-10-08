import { Decimal } from "./decimal";
import type { Inquiry, InquiryProduct } from "../huawei-native/types";
import type { InquiryResponse } from "../huawei-native/quotes";
import type { CatalogProduct, Plan, ScopeSnapshot } from "./types";

// Dimensions are converted before applying the published billing plans. No network access.
const units: Record<number, [string, number]> = {
  0: ["time", 86400],
  4: ["time", 3600],
  5: ["time", 60],
  6: ["time", 1],
  19: ["time", 365 * 86400],
  20: ["time", 30 * 86400],
  24: ["time", 86400],
  25: ["time", 3600],
  7: ["bytes", 1024 ** 6],
  8: ["bytes", 1024 ** 5],
  9: ["bytes", 1024 ** 4],
  10: ["bytes", 1024 ** 3],
  11: ["bytes", 1024 ** 2],
  12: ["bytes", 1024],
  13: ["bytes", 1],
  16: ["bytes", 1],
  17: ["bytes", 1024 ** 3],
  21: ["bytes", 1024 ** 2],
  47: ["bytes", 1024 ** 4],
  48: ["bytes", 1024 ** 5],
  90: ["bytes", 1],
  91: ["bytes", 1000],
  92: ["bytes", 1000 ** 2],
  93: ["bytes", 1000 ** 3],
  94: ["bytes", 1000 ** 4],
  100: ["bytes", 1024],
  101: ["bytes", 1024 ** 2],
  102: ["bytes", 1024 ** 3],
  103: ["bytes", 1024 ** 4],
  97: ["tokens", 1000],
  108: ["tokens", 1],
  109: ["tokens", 1000],
  110: ["tokens", 10000],
  111: ["tokens", 1000000],
  112: ["tokens", 1000000000],
  14: ["count", 1],
  30: ["count", 1],
  31: ["count", 1000],
  32: ["count", 1e6],
  33: ["count", 1e9],
  40: ["count", 1],
  41: ["count", 1],
  42: ["count", 1000],
  43: ["count", 1],
  44: ["count", 1000],
  54: ["count", 1e4],
  56: ["count", 1e4],
  15: ["bandwidth", 1e6],
  34: ["bandwidth", 1],
  35: ["bandwidth", 1000],
  36: ["bandwidth", 1e6],
  37: ["bandwidth", 1e9],
  38: ["bandwidth", 1e12],
  51: ["bandwidth", 1e6],
  52: ["bandwidth", 1e9],
  53: ["bandwidth", 1e12],
  39: ["gbtime", 1],
  70: ["gbtime", 1],
  71: ["gbtime", 60],
  72: ["gbtime", 3600],
  73: ["gbtime", 86400],
  66: ["coretime", 1],
  67: ["coretime", 60],
  68: ["coretime", 3600],
  69: ["coretime", 86400],
  74: ["iopstime", 1],
  75: ["iopstime", 3600],
  76: ["throughputtime", 1],
  77: ["throughputtime", 3600],
};
const finite = (value: number, label: string) => {
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value))
    value = Number(value);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${label}`);
  return value;
};
export const rounded = (value: number) => Decimal.of(value).rounded(8);
export function convert(
  value: number,
  from: number | string | undefined,
  to: number | null | undefined,
) {
  value = finite(value, "usage");
  if (to == null || from == null || Number(from) === to) return value;
  const a = units[Number(from)],
    b = units[to];
  if (!a || !b || a[0] !== b[0])
    throw new Error(`Unsupported unit conversion ${from} to ${to}`);
  return (value * a[1]) / b[1];
}
function tierAmount(plan: Plan, size: number, normalize: boolean) {
  if (size === 0) return Decimal.of(0);
  const rangeUnit = plan.divisionList![0].division.beginUnit;
  const tiers = plan.divisionList!.map((tier) => ({
    ...tier,
    division: {
      ...tier.division,
      beginValue: normalize
        ? convert(tier.division.beginValue, tier.division.beginUnit, rangeUnit)
        : tier.division.beginValue,
      endValue:
        normalize && tier.division.endValue !== -1
          ? convert(tier.division.endValue, tier.division.endUnit, rangeUnit)
          : tier.division.endValue,
    },
  }));
  if (!["DIVISION_STEP", "DIVISION_TIER"].includes(plan.divisionType ?? ""))
    throw new Error("Unsupported pricing tiers");
  const picked = tiers.find(
    (t) =>
      size > t.division.beginValue &&
      (t.division.endValue === -1 || size <= t.division.endValue),
  );
  if (!picked) throw new Error("No price for this quantity");
  if (plan.divisionType === "DIVISION_TIER")
    return Decimal.of(size)
      .mul(finite(picked.amount, "tier rate"))
      .div(normalize ? picked.division.measureUnitStep || 1 : 1);
  return tiers.reduce((sum, tier) => {
    const end =
      tier.division.endValue === -1 ? Infinity : tier.division.endValue;
    const width = Decimal.of(Math.min(size, end)).sub(
      Decimal.of(tier.division.beginValue),
    );
    return width.numerator > BigInt(0)
      ? sum.add(
          width
            .mul(finite(tier.amount, "tier rate"))
            .div(normalize ? tier.division.measureUnitStep || 1 : 1),
        )
      : sum;
  }, Decimal.of(0));
}
const catalogCache = new WeakMap<ScopeSnapshot, CatalogProduct[]>();
const productIndexes = new WeakMap<
  CatalogProduct[],
  Map<string, CatalogProduct[]>
>();
export function catalogRows(snapshot: ScopeSnapshot) {
  const cached = catalogCache.get(snapshot);
  if (cached) return cached;
  const rows: CatalogProduct[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const row = value as CatalogProduct;
    if (row.resourceSpecCode && Array.isArray(row.planList)) rows.push(row);
    for (const [key, child] of Object.entries(row))
      if (key !== "planList") visit(child);
  }
  visit(snapshot.products.product);
  catalogCache.set(snapshot, rows);
  return rows;
}
export function matchingPlans(
  rows: CatalogProduct[],
  request: Inquiry,
  product: InquiryProduct & {
    skuCode?: string;
    productId?: string;
    bizExtAttributes?: { key: string; value: unknown }[];
  },
) {
  const billingMode = (
    {
      0: request.periodType === 3 ? "YEARLY" : "MONTHLY",
      1: "ONDEMAND",
      10: "RI",
      2: "ONETIME",
    } as Record<number, string>
  )[request.chargingMode];
  if (!billingMode) throw new Error("Unsupported billing mode");
  let index = productIndexes.get(rows);
  if (!index) {
    index = new Map();
    for (const row of rows) {
      const key = JSON.stringify([
        row.cloudServiceType,
        row.resourceType,
        row.resourceSpecCode,
      ]);
      const group = index.get(key) ?? [];
      group.push(row);
      index.set(key, group);
    }
    productIndexes.set(rows, index);
  }
  const matching =
    index
      .get(
        JSON.stringify([
          product.cloudServiceType,
          product.resourceType,
          product.resourceSpecCode,
        ]),
      )
      ?.filter(
        (row) => (row.locationCode ?? "") === (request.availableZoneId ?? ""),
      ) ?? [];
  let plans = matching.flatMap((row) =>
    (row.planList ?? [])
      .filter(
        (plan) =>
          plan.billingMode === billingMode &&
          (!plan.siteCode || plan.siteCode === request.siteCode) &&
          (!product.skuCode || plan.skuCode === product.skuCode) &&
          (!product.productId || plan.productId === product.productId),
      )
      .map((plan) => ({ row, plan })),
  );
  if (billingMode === "RI") {
    plans = plans.filter(
      ({ row }) =>
        row.RITime === `nodeData.${request.periodNum}_${request.periodType}`,
    );
  } else if (billingMode === "YEARLY" && !plans.length) {
    plans = matching.flatMap((row) =>
      (row.planList ?? [])
        .filter(
          (plan) =>
            plan.billingMode === "MONTHLY" &&
            (!plan.siteCode || plan.siteCode === request.siteCode) &&
            (!product.skuCode || plan.skuCode === product.skuCode) &&
            (!product.productId || plan.productId === product.productId),
        )
        .map((plan) => ({ row, plan })),
    );
  }
  const install = product.bizExtAttributes?.find(
    (a) => a.key === "fee_install_mode",
  )?.value;
  plans = plans.filter(({ plan }) =>
    install
      ? plan.feeInstallMode === install
      : !plan.feeInstallMode || plan.feeInstallMode === "ALL_PAY",
  );
  if (product.usageFactor) {
    const exact = plans.filter(
      ({ plan }) =>
        !plan.usageFactor ||
        plan.usageFactor.toLowerCase() === product.usageFactor!.toLowerCase(),
    );
    if (exact.length) plans = exact;
  }
  if (!plans.length)
    throw new Error(
      `No synchronized rate for ${product.resourceSpecCode}/${billingMode}`,
    );
  return plans;
}
export function ratingRuleKey(
  snapshot: ScopeSnapshot,
  request: Inquiry,
  product: InquiryProduct,
) {
  const plans = matchingPlans(catalogRows(snapshot), request, product).filter(
    ({ plan }) =>
      plan.billingMode !== "YEARLY" ||
      request.periodNum % (plan.periodNum ?? 1) === 0,
  );
  plans.sort((a, b) => (b.plan.periodNum ?? 1) - (a.plan.periodNum ?? 1));
  const plan = plans[0]?.plan;
  if (!plan) throw new Error("Missing rate plan");
  return planRuleKey(request, product, plan, snapshot.ratingRuleVersion ?? 1);
}
export function planRuleKey(
  request: Inquiry,
  product: InquiryProduct,
  plan: Plan,
  version: 1 | 2 = 1,
) {
  return JSON.stringify([
    product.cloudServiceType,
    product.resourceType,
    product.resourceSpecCode,
    plan.billingMode,
    plan.periodNum || 1,
    plan.productId || "",
    plan.skuCode || "",
    plan.usageFactor || "",
    ...(version === 2 ? [request.siteCode] : []),
    ...(version === 2 && request.availableZoneId
      ? [request.availableZoneId]
      : []),
    ...(version === 2 && request.chargingMode === 1
      ? [
          product.usageMeasureId == null
            ? null
            : Number(product.usageMeasureId),
          product.resouceSizeMeasureId == null
            ? null
            : Number(product.resouceSizeMeasureId),
        ]
      : []),
    ...(request.chargingMode === 10
      ? [request.periodNum, request.periodType]
      : []),
  ]);
}
export function rateInquiry(
  snapshot: ScopeSnapshot,
  request: Inquiry,
  truncate = true,
): InquiryResponse {
  if (
    request.regionId !== snapshot.region ||
    !new Set([
      "HWC",
      ...catalogRows(snapshot).flatMap((row) =>
        (row.planList ?? []).map((plan) => plan.siteCode),
      ),
    ]).has(request.siteCode) ||
    !Array.isArray(request.productInfos) ||
    request.productInfos.length > 100
  )
    throw new Error("Quotation scope does not match the synchronized catalog");
  if (
    (request.chargingMode !== 2 &&
      (!Number.isSafeInteger(request.periodNum) ||
        request.periodNum < 1 ||
        request.periodNum > 9999)) ||
    !Number.isSafeInteger(request.subscriptionNum) ||
    request.subscriptionNum !== 1 ||
    (request.chargingMode === 0 && ![2, 3].includes(request.periodType))
  )
    throw new Error("Invalid billing period");
  const rows = catalogRows(snapshot),
    ids = new Set<string>();
  let exactTotal = Decimal.of(0);
  const productRatingResult = request.productInfos.map((product) => {
    if (!product.id || ids.has(product.id))
      throw new Error("Invalid resource identifiers");
    ids.add(product.id);
    // Huawei defaults an explicitly null/missing quantity to one (observed in CDN traffic requests).
    const quantity = finite(product.productNum ?? 1, "quantity");
    if (quantity > 10000)
      throw new Error("Quantity exceeds Huawei’s calculation limit (10000)");
    const rule =
      snapshot.ratingRules?.[ratingRuleKey(snapshot, request, product)];
    const candidates = matchingPlans(rows, request, product);
    let amount: Decimal, perAmount: number | undefined;
    if (request.chargingMode === 10) {
      const upfront = candidates.find(
        ({ plan }) => plan.originType === "price",
      );
      const recurring = candidates.find(
        ({ plan }) => plan.originType === "perEffectivePrice",
      );
      if (!upfront) throw new Error("Missing synchronized RI payment");
      amount = Decimal.of(finite(upfront.plan.amount!, "RI upfront rate")).mul(
        quantity,
      );
      const monthly = candidates.find(
        ({ plan }) => plan.originType === "perPrice",
      );
      perAmount =
        monthly?.plan.amount === 0
          ? 0
          : recurring
            ? finite(recurring.plan.amount!, "RI recurring rate") * quantity
            : 0;
    } else {
      const n =
        request.periodType === 3 ? request.periodNum * 12 : request.periodNum;
      const choices = candidates.filter(
        ({ plan }) =>
          plan.billingMode !== "YEARLY" ||
          request.periodNum % (plan.periodNum ?? 1) === 0,
      );
      choices.sort((a, b) => (b.plan.periodNum ?? 1) - (a.plan.periodNum ?? 1));
      if (!choices.length) throw new Error("Unsupported subscription term");
      const { plan } = choices[0];
      if (plan.condition)
        throw new Error(
          "This conditional price requires a supported local rule",
        );
      const size =
        rule?.size === "ignore"
          ? 1
          : finite(product.resourceSize ?? 1, "resource size");
      const duration =
        /duration|period/i.test(
          product.usageFactor ?? plan.usageFactor ?? "",
        ) || units[Number(product.usageMeasureId)]?.[0] === "time";
      let base: Decimal;
      if (plan.divisionList) {
        const tierUnit = plan.divisionList[0]?.division.beginUnit;
        const tierUsesSize = request.chargingMode !== 1 || duration;
        const tierSize = tierUsesSize
          ? convert(
              product.resourceSize ?? 1,
              product.resouceSizeMeasureId,
              tierUnit,
            )
          : convert(product.usageValue ?? 0, product.usageMeasureId, tierUnit);
        base = tierAmount(plan, tierSize, snapshot.ratingRuleVersion === 2);
        if (request.chargingMode === 1 && duration)
          base = base.mul(
            Decimal.of(product.usageValue ?? 1)
              .mul(units[Number(product.usageMeasureId)]?.[1] ?? 3600)
              .div(3600),
          );
      } else {
        base = Decimal.of(finite(plan.amount!, "rate"));
        if (request.chargingMode === 1) {
          const target =
            plan.measureUnit ?? (duration ? 4 : plan.usageMeasureId);
          let usage: number;
          // Composite capacity/time units share their time scale with duration inputs.
          if (
            duration &&
            target != null &&
            units[target]?.[0]?.endsWith("time") &&
            units[target][0] !== "time"
          )
            usage =
              ((product.usageValue ?? 1) *
                (units[Number(product.usageMeasureId)]?.[1] ?? 1)) /
              units[target][1];
          else
            usage = convert(
              product.usageValue ?? 1,
              product.usageMeasureId,
              target,
            );
          const from = units[Number(product.usageMeasureId)],
            to = target == null ? undefined : units[target];
          const usageDecimal =
            from && to
              ? Decimal.of(product.usageValue ?? 1)
                  .mul(from[1])
                  .div(to[1])
              : Decimal.of(usage);
          base = base.mul(usageDecimal).div(plan.measureUnitStep || 1);
        }
        if (request.chargingMode !== 1 || duration) base = base.mul(size);
      }
      if (request.chargingMode === 0)
        base = base
          .mul(plan.billingMode === "YEARLY" ? request.periodNum : n)
          .div(plan.periodNum || 1);
      amount = base.mul(quantity);
      amount = rule?.scale
        ? amount.mul(rule.scale.numerator).div(rule.scale.denominator)
        : amount.mul(rule?.multiplier ?? 1);
      if (plan.perAmount !== undefined) perAmount = plan.perAmount * quantity;
    }
    exactTotal = exactTotal.add(amount);
    const ratedAmount = truncate
      ? request.chargingMode === 1 && rule?.rounding === "round"
        ? amount.rounded(6)
        : request.chargingMode === 1 && rule?.rounding === "round7-floor6"
          ? amount.quantized(7).truncated(6)
          : amount.truncated(request.chargingMode === 1 ? 6 : 2)
      : amount.number();
    finite(ratedAmount, "price");
    return {
      id: product.id,
      productId: candidates[0].plan.productId,
      amount: ratedAmount,
      originalAmount: ratedAmount,
      discountAmount: 0,
      ...(perAmount !== undefined ? { perAmount: rounded(perAmount) } : {}),
    };
  });
  return {
    amount: truncate
      ? rounded(productRatingResult.reduce((sum, r) => sum + r.amount, 0))
      : productRatingResult.reduce((sum, r) => sum + r.amount, 0),
    currency: "USD",
    ...(!truncate
      ? {
          exactAmount: {
            numerator: String(exactTotal.numerator),
            denominator: String(exactTotal.denominator),
          },
        }
      : {}),
    productRatingResult,
    ...(productRatingResult.some((r) => r.perAmount !== undefined)
      ? {
          perAmount: rounded(
            productRatingResult.reduce((sum, r) => sum + (r.perAmount ?? 0), 0),
          ),
        }
      : {}),
  };
}
