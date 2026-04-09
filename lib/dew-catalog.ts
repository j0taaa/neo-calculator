import type { PricingRateSet, RegionalPricingCatalog, ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DewKeyType = string;

export type DewRateSet = PricingRateSet<"ONDEMAND">;

export interface DewInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  label: string;
}

export interface DewPricingCatalog extends RegionalPricingCatalog {
  tiers: DewInstanceTier[];
}

export interface DewEstimateInput {
  keyType: string;
  quantity: number;
  usageHours: number;
}

export interface DewEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DewEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: DewInstanceTier;
  productId: string | null;
  breakdown: DewEstimateBreakdownItem[];
  notes: string[];
}

export const dewDefaults = {
  keyType: "Customer Master Key",
  quantity: 1,
  usageHours: 744,
} as const;

export const dewPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/dew",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/dew.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listDewKeyTypes(catalog: DewPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.label);
    }
  }
  return Array.from(values).sort();
}

export function findDewTier(catalog: DewPricingCatalog, keyType: string): DewInstanceTier | null {
  return catalog.tiers.find((tier) => tier.label === keyType) ?? null;
}

export function estimateDewConfiguration(catalog: DewPricingCatalog, input: DewEstimateInput): DewEstimate | null {
  const tier = findDewTier(catalog, input.keyType);
  if (!tier || tier.prices.ONDEMAND == null) return null;

  const quantity = Math.max(1, Math.floor(input.quantity));
  const usageHours = Math.max(1, Math.floor(input.usageHours ?? 0));

  const amount = roundAmount(tier.prices.ONDEMAND * quantity * usageHours);
  const suffix = `/${usageHours}h`;
  const productId = tier.productIds.ONDEMAND ?? null;

  const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));

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
        label: `${quantity} x ${input.keyType}`,
        amount,
      },
    ],
    notes: [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(2)}/key/h.`],
  };
}
