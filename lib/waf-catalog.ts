import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type WafRateSet = PricingRateSet<"MONTHLY" | "YEARLY">;

export interface WafInstanceTier extends ResourcePricingTierWithProducts<"MONTHLY" | "YEARLY"> {
  edition: string;
}

export interface WafPricingCatalog extends RegionalPricingCatalog {
  tiers: WafInstanceTier[];
}

export interface WafEstimateInput {
  edition: string;
  quantity: number;
}

export interface WafEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface WafEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  breakdown: WafEstimateBreakdownItem[];
  notes: string[];
}

export const wafDefaults = {
  edition: "Standard",
  quantity: 1,
} as const;

export const wafPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/waf",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/waf.html",
} as const;

const editionOrder = ["Standard", "Professional", "Enterprise"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listWafEditions(catalog: WafPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.MONTHLY != null || tier.prices.YEARLY != null) {
      values.add(tier.edition);
    }
  }
  return orderedSet(values, editionOrder);
}

export function findWafTier(catalog: WafPricingCatalog, edition: string): WafInstanceTier | null {
  return catalog.tiers.find((tier) => tier.edition === edition) ?? null;
}

export function estimateWafConfiguration(catalog: WafPricingCatalog, input: WafEstimateInput): WafEstimate | null {
  const tier = findWafTier(catalog, input.edition);
  if (!tier) return null;

  const quantity = Math.max(1, Math.floor(input.quantity));

  if (tier.prices.MONTHLY != null) {
    const amount = roundAmount(tier.prices.MONTHLY * quantity);
    return {
      currency: catalog.currency,
      amount,
      suffix: "/mo",
      monthlyAverageAmount: amount,
      quantity,
      breakdown: [
        {
          label: `${quantity} x ${input.edition}`,
          amount,
        },
      ],
      notes: [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY.toFixed(2)}/instance/mo.`],
    };
  }

  if (tier.prices.YEARLY != null) {
    const amount = roundAmount(tier.prices.YEARLY * quantity);
    return {
      currency: catalog.currency,
      amount,
      suffix: "/yr",
      monthlyAverageAmount: roundAmount(amount / 12),
      quantity,
      breakdown: [
        {
          label: `${quantity} x ${input.edition}`,
          amount,
        },
      ],
      notes: [`Yearly rate: ${catalog.currency} ${tier.prices.YEARLY.toFixed(2)}/instance/yr.`],
    };
  }

  return null;
}
