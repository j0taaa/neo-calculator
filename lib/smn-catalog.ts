import type { PricingRateSet, RegionalPricingCatalog, ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type SmnProtocolType = string;

export type SmnRateSet = PricingRateSet<"ONDEMAND">;

export interface SmnInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  label: string;
}

export interface SmnPricingCatalog extends RegionalPricingCatalog {
  tiers: SmnInstanceTier[];
}

export interface SmnEstimateInput {
  protocolType: string;
  quantity: number;
  usageHours: number;
}

export interface SmnEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface SmnEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: SmnInstanceTier;
  productId: string | null;
  breakdown: SmnEstimateBreakdownItem[];
  notes: string[];
}

export const smnDefaults = {
  protocolType: "HTTP/HTTPS",
  quantity: 1,
  usageHours: 744,
} as const;

export const smnPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/smn",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/smn.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listSmnProtocolTypes(catalog: SmnPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.label);
    }
  }
  return Array.from(values).sort();
}

export function findSmnTier(catalog: SmnPricingCatalog, protocolType: string): SmnInstanceTier | null {
  return catalog.tiers.find((tier) => tier.label === protocolType) ?? null;
}

export function estimateSmnConfiguration(catalog: SmnPricingCatalog, input: SmnEstimateInput): SmnEstimate | null {
  const tier = findSmnTier(catalog, input.protocolType);
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
        label: `${quantity} x ${input.protocolType}`,
        amount,
      },
    ],
    notes: [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(2)}/instance/h.`],
  };
}
