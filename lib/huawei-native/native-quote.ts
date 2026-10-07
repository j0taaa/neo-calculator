import type { NativeBillingMode } from "./native-billing";
import { nativeBillingModes, isNativeBillingMode } from "./native-billing";
import type { Inquiry, Quote } from "./types";
import type { NativePricing, NativeInquiryQuote } from "./native-pricing";

/** Validate the complete vendor aggregation and all of its fresh inquiry components together. */
export function validateAggregatedQuote(
  pricing: NativePricing,
  captured: NativeInquiryQuote[],
  scope: {
    service: string;
    region: string;
    billingMode: NativeBillingMode;
    releaseId: string;
  },
  fingerprint: (value: unknown) => string = JSON.stringify,
): { quote: Quote; inquiries: Inquiry[] } {
  const { selectedProduct: selected, result } = pricing;
  if (
    pricing.pending ||
    !result ||
    result.wrongTag ||
    result.timeTag !== selected.timeTag
  )
    throw new Error("Huawei has not completed pricing this configuration");
  if (
    selected.region !== scope.region ||
    selected.serviceCode !== scope.service ||
    selected.chargeMode !== scope.billingMode
  )
    throw new Error(
      "Huawei returned a different service, region or billing mode",
    );
  const tags = [
    "normal",
    "combine",
    "sameNamePackage",
    "support",
    "localImage",
    "listCalc",
  ];
  const selectedProducts = selected.productAllInfos.filter(
    (product) => product.inquiryTag !== false,
  );
  if (
    !selectedProducts.length ||
    selectedProducts.length > 100 ||
    selectedProducts.some(
      (product) => !tags.includes(product.inquiryTag as string),
    )
  )
    throw new Error("Unsupported Huawei pricing components");
  // Huawei's inquiry builder omits normal/package components with zero quantity.
  // Other component types retain their vendor-specific aggregation behavior.
  const products = selectedProducts.filter(
    (product) =>
      !(
        product.productNum === 0 &&
        ["normal", "combine", "sameNamePackage"].includes(
          product.inquiryTag as string,
        )
      ),
  );
  const expected = new Map(
    products.map((product) => [
      `${selected.timeTag}-${product.selectIndex}-${product.productId || "noId"}`,
      product,
    ]),
  );
  if (
    expected.size !== products.length ||
    result.productRatingResult?.length !== expected.size ||
    !Number.isFinite(result.amount) ||
    result.amount < 0
  )
    throw new Error("Incomplete Huawei aggregate price");
  const seen = new Set<string>();
  const breakdown = result.productRatingResult.map((item) => {
    const product = expected.get(item.id);
    if (
      !product ||
      seen.has(item.id) ||
      !Number.isFinite(item.amount) ||
      item.amount < 0
    )
      throw new Error("Incomplete Huawei aggregate components");
    seen.add(item.id);
    return {
      id: item.id,
      amount: item.amount,
      label: product.resourceSpecCode,
    };
  });
  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
  if (
    Math.abs(total - result.amount) >
    Math.max(0.000001, Math.abs(result.amount) * 1e-12)
  )
    throw new Error("Huawei aggregate price does not match its components");
  const requests = captured.filter(({ inquiry }) =>
    inquiry.productInfos.every((product) =>
      product.id.startsWith(`${selected.timeTag}-`),
    ),
  );
  const rated = new Set<string>();
  for (const { inquiry, response } of requests) {
    if (inquiry.regionId !== scope.region || response.currency !== "USD")
      throw new Error("Unexpected Huawei pricing scope or currency");
    for (const item of response.productRatingResult) {
      const product = expected.get(item.id);
      const mode = product?._injectedMode ?? scope.billingMode;
      if (
        !product ||
        rated.has(item.id) ||
        !isNativeBillingMode(mode) ||
        inquiry.chargingMode !== nativeBillingModes[mode].chargingMode
      )
        throw new Error("Unexpected Huawei billing component");
      if (inquiry.siteCode !== (product.siteCode ?? "HWC"))
        throw new Error("Unexpected Huawei product billing site");
      rated.add(item.id);
      if (mode === "RI" && Number(product.perPrice ?? 0) > 0) {
        const effective = Number(product.perEffectivePrice);
        if (
          !Number.isFinite(effective) ||
          !Number.isFinite(item.perAmount) ||
          Math.abs(item.perAmount! - effective * product.productNum) > 0.000001
        )
          throw new Error(
            "Huawei's RI recurring rate changed. Reopen the calculator to refresh its products.",
          );
      }
    }
  }
  for (const [id, product] of expected) {
    if (
      ["normal", "combine", "sameNamePackage"].includes(
        product.inquiryTag as string,
      ) &&
      !rated.has(id)
    )
      throw new Error("A fresh Huawei component quote is missing");
  }
  const quote: Quote = {
    amount: result.amount,
    currency: "USD",
    quotedAt: new Date().toISOString(),
    releaseId: scope.releaseId,
    requestHash: fingerprint({ requests, result }),
    source: requests.length ? "huawei-inquiry" : "huawei-catalog",
    aggregation: "huawei-renderer",
    breakdown,
  };
  if (result.installNum !== undefined) {
    const values = [
      result.installNum,
      result.installAmount ?? 0,
      result.perAmount ?? 0,
      ...Object.values(result.injectedAmount ?? {}).map(
        (extra) => extra.perAmount,
      ),
    ];
    if (
      values.some((value) => !Number.isFinite(value) || value < 0) ||
      !Number.isSafeInteger(result.installNum) ||
      result.installNum < 1
    )
      throw new Error("Invalid Huawei installment price");
    const paymentTotal =
      (result.installAmount ?? 0) +
      ((result.perAmount ?? 0) +
        Object.values(result.injectedAmount ?? {}).reduce(
          (sum, extra) => sum + extra.perAmount,
          0,
        )) *
        result.installNum;
    if (Math.abs(paymentTotal - result.amount) > 0.000001)
      throw new Error("Huawei payment schedule does not match the total price");
    const period = result.installPeriodType;
    if (!["MONTH", 2, "YEAR", 3].includes(period!))
      throw new Error("Unknown Huawei installment period");
    quote.payment = {
      upfront: result.installAmount ?? 0,
      recurring: result.perAmount ?? 0,
      installments: result.installNum,
      period: period === "YEAR" || period === 3 ? "Year" : "Month",
      extras: Object.entries(result.injectedAmount ?? {}).map(
        ([mode, extra]) => ({ mode, recurring: extra.perAmount }),
      ),
    };
  }
  return { quote, inquiries: requests.map((request) => request.inquiry) };
}
