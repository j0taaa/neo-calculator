import type { PricingRateSet, RegionalPricingCatalog, ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type HssEdition = string;

export type HssRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface HssInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  edition: string;
  editionLabel: string;
}

export interface HssPricingCatalog extends RegionalPricingCatalog {
  tiers: HssInstanceTier[];
}

export interface HssEstimateInput {
  edition: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
}

export interface HssEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface HssEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: HssInstanceTier;
  productId: string | null;
  breakdown: HssEstimateBreakdownItem[];
  notes: string[];
}

export const hssDefaults = {
  edition: "hss.version.type:Advanced",
  quantity: 1,
  usageHours: 744,
} as const;

export const hssPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/hss",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/hss.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listHssEditions(catalog: HssPricingCatalog, billingMode?: "Pay-per-use" | "Yearly/Monthly"): Array<{ value: string; label: string }> {
  const values = new Map<string, string>();
  for (const tier of catalog.tiers) {
    const hasOnDemand = tier.prices.ONDEMAND != null;
    const hasMonthly = tier.prices.MONTHLY != null;
    const hasYearly = tier.prices.YEARLY != null;
    
    if (billingMode === "Pay-per-use") {
      if (!hasOnDemand) continue;
    } else if (billingMode === "Yearly/Monthly") {
      if (!hasMonthly && !hasYearly) continue;
    } else {
      if (!hasOnDemand && !hasMonthly && !hasYearly) continue;
    }
    
    if (tier.editionLabel) {
      values.set(tier.edition, tier.editionLabel);
    }
  }
  return Array.from(values.entries()).map(([value, label]) => ({ value, label }));
}

export function findHssTier(catalog: HssPricingCatalog, edition: string): HssInstanceTier | null {
  return catalog.tiers.find((tier) => tier.edition === edition) ?? null;
}

export function estimateHssConfiguration(catalog: HssPricingCatalog, input: HssEstimateInput): HssEstimate | null {
  const tier = findHssTier(catalog, input.edition);
  if (!tier) return null;

  const quantity = Math.max(1, Math.floor(input.quantity));

  let amount: number;
  let suffix: string;
  let productId: string | null = null;
  let usageHours = input.usageHours ?? 0;

  if (input.billingMode === "Yearly/Monthly") {
    if (tier.prices.MONTHLY != null) {
      amount = roundAmount(tier.prices.MONTHLY * quantity);
      suffix = "/mo";
      productId = tier.productIds.MONTHLY ?? null;
    } else if (tier.prices.YEARLY != null) {
      amount = roundAmount(tier.prices.YEARLY * quantity);
      suffix = "/yr";
      productId = tier.productIds.YEARLY ?? null;
    } else {
      return null;
    }
  } else {
    if (tier.prices.ONDEMAND == null) return null;
    usageHours = Math.max(1, Math.floor(input.usageHours));
    amount = roundAmount(tier.prices.ONDEMAND * quantity * usageHours);
    suffix = `/${usageHours}h`;
    productId = tier.productIds.ONDEMAND ?? null;
  }

  const monthlyAverageAmount = input.billingMode === "Yearly/Monthly"
    ? amount
    : roundAmount(amount / (usageHours / (24 * 30)));

  return {
    currency: catalog.currency,
    amount,
    suffix,
    monthlyAverageAmount,
    quantity,
    usageHours,
    tier,
    productId,
    breakdown: [
      {
        label: `${quantity} x ${tier.editionLabel || input.edition}`,
        amount,
      },
    ],
    notes: input.billingMode === "Pay-per-use"
      ? [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND!.toFixed(2)}/instance/h.`]
      : [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY!.toFixed(2)}/instance/mo.`],
  };
}
