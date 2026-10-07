import type { NativePricing } from "../huawei-native/native-pricing";
import type { Inquiry } from "../huawei-native/types";
import { validateAggregatedQuote } from "../huawei-native/native-quote";
import { catalogRows, rateInquiry, rounded } from "./rating";
import type { ScopeSnapshot } from "./types";

/** Rebuild every monetary value from published rates. Client totals are never authoritative. */
export function calculateQuote(
  snapshot: ScopeSnapshot,
  release: string,
  pricing: NativePricing,
  inquiries: Inquiry[],
) {
  const selected = pricing.selectedProduct;
  if (
    !selected ||
    (selected.chargeMode !== "ONETIME" &&
      (!Number.isSafeInteger(selected.periodNum) ||
        selected.periodNum < 1 ||
        selected.periodNum > 9999)) ||
    !Array.isArray(selected.productAllInfos)
  )
    throw new Error("Invalid local quotation");
  const captured = inquiries.map((inquiry) => ({
    inquiry,
    response: rateInquiry(snapshot, inquiry),
  }));
  const rated = new Map(
    captured.flatMap(({ inquiry, response }) =>
      response.productRatingResult.map(
        (item) => [item.id, { item, inquiry }] as const,
      ),
    ),
  );
  const rows = catalogRows(snapshot),
    months = selected.periodNum * (selected.periodType === 3 ? 12 : 1);
  let upfront = 0,
    recurring = 0;
  const extras: Record<string, { amount: number; perAmount: number }> = {};
  const installment =
    selected.chargeMode === "RI" ||
    selected.productAllInfos.every((p) => p.feeInstallMode);
  const installNum =
    selected.chargeMode === "RI"
      ? months
      : Number(selected.productAllInfos[0]?.installNum ?? 1);
  const components = selected.productAllInfos
    .filter(
      (p) =>
        p.inquiryTag !== false &&
        !(
          p.productNum === 0 &&
          ["normal", "combine", "sameNamePackage"].includes(
            String(p.inquiryTag),
          )
        ),
    )
    .map((product) => {
      const id = `${selected.timeTag}-${product.selectIndex}-${product.productId || "noId"}`;
      const quote = rated.get(id);
      let amount: number;
      if (quote) {
        const requestProduct = quote.inquiry.productInfos.find(
          (p) => p.id === id,
        )!;
        if (
          requestProduct.resourceSpecCode !== product.resourceSpecCode ||
          requestProduct.productNum !== product.productNum
        )
          throw new Error("Selected resource does not match its calculation");
        if (
          !product._injectedMode &&
          [0, 10].includes(quote.inquiry.chargingMode) &&
          (quote.inquiry.periodNum !== selected.periodNum ||
            quote.inquiry.periodType !== selected.periodType)
        )
          throw new Error(
            "The inquiry period does not match the selected subscription",
          );
        for (const key of ["cloudServiceType", "resourceType"] as const)
          if (
            product[key] !== undefined &&
            product[key] !== requestProduct[key]
          )
            throw new Error(
              "The inquiry resource type does not match the selected component",
            );
        amount = quote.item.amount;
        if (selected.chargeMode === "RI") {
          if (product._injectedMode) {
            const mode = String(product._injectedMode),
              monthly = amount;
            amount = rounded(monthly * installNum);
            const prior = extras[mode] ?? { amount: 0, perAmount: 0 };
            extras[mode] = {
              amount: rounded(prior.amount + amount),
              perAmount: rounded(prior.perAmount + monthly),
            };
          } else {
            const plans = rows
              .filter(
                (row) =>
                  row.resourceSpecCode === product.resourceSpecCode &&
                  row.RITime ===
                    `nodeData.${selected.periodNum}_${selected.periodType}`,
              )
              .flatMap((row) => row.planList ?? []);
            const plan = plans.find(
              (plan) =>
                plan.productId === product.productId &&
                plan.originType === "perPrice",
            );
            if (!plan || !Number.isFinite(plan.amount))
              throw new Error("Missing RI recurring payment");
            const monthly = rounded(plan.amount! * product.productNum);
            upfront += amount;
            recurring += monthly;
            amount = rounded(amount + monthly * installNum);
          }
        } else if (installment) {
          upfront += amount;
          recurring += Number(quote.item.perAmount ?? 0);
          amount = rounded(
            amount + Number(quote.item.perAmount ?? 0) * installNum,
          );
        }
      } else if (product.inquiryTag === "localImage") {
        // Local images are free only when present as unpriced images in this release.
        const images = Object.values(snapshot.products.product)
          .flat()
          .filter(
            (row) =>
              row.resourceSpecCode === product.resourceSpecCode &&
              row.resourceType === product.resourceType,
          );
        if (
          !images.length ||
          images.some((row) =>
            row.planList?.some((plan) => Number(plan.amount) > 0),
          )
        )
          throw new Error("Unverified image price");
        amount = 0;
      } else {
        throw new Error(
          `Unsupported local pricing component: ${product.inquiryTag}`,
        );
      }
      return { id, productId: product.productId, amount };
    });
  const result: NativePricing["result"] = {
    amount: rounded(components.reduce((sum, item) => sum + item.amount, 0)),
    timeTag: selected.timeTag,
    productRatingResult: components,
  };
  if (installment)
    Object.assign(result, {
      installNum,
      installPeriodType:
        selected.chargeMode === "RI"
          ? "MONTH"
          : selected.productAllInfos[0]?.installPeriodType,
      installAmount: rounded(upfront),
      perAmount: rounded(recurring),
      injectedAmount: extras,
    });
  return validateAggregatedQuote(
    { ...pricing, pending: false, result },
    captured,
    {
      service: snapshot.service,
      region: snapshot.region,
      billingMode: selected.chargeMode,
      releaseId: release,
    },
  );
}
