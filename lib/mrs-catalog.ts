import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type MrsClusterType = "Analysis" | "Streaming";
export type MrsBillingType = "Pay-per-use";

export type MrsRateSet = PricingRateSet<"ONDEMAND">;

export interface MrsInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  clusterType: string;
  label: string;
  nodeType: string;
}

export interface MrsPricingCatalog extends RegionalPricingCatalog {
  tiers: MrsInstanceTier[];
}

export interface MrsEstimateInput {
  clusterType: string;
  nodeType: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use";
}

export interface MrsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface MrsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: MrsInstanceTier;
  productId: string | null;
  breakdown: MrsEstimateBreakdownItem[];
  notes: string[];
}

export const mrsDefaults = {
  clusterType: "Analysis",
  nodeType: "Master",
  quantity: 1,
  usageHours: 744,
} as const;

export const mrsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/mrs",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/mrs.html",
} as const;

const clusterTypeOrder = ["Analysis", "Streaming"];
const nodeTypeOrder = ["Master", "Core", "Task"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listMrsClusterTypes(catalog: MrsPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.clusterType);
    }
  }
  return orderedSet(values, clusterTypeOrder);
}

export function listMrsNodeTypes(catalog: MrsPricingCatalog, clusterType: string): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.clusterType === clusterType && tier.prices.ONDEMAND != null) {
      values.add(tier.nodeType);
    }
  }
  return orderedSet(values, nodeTypeOrder);
}

export function findMrsTier(catalog: MrsPricingCatalog, clusterType: string, nodeType: string): MrsInstanceTier | null {
  return catalog.tiers.find((tier) => tier.clusterType === clusterType && tier.nodeType === nodeType && tier.prices.ONDEMAND != null) ?? null;
}

export function estimateMrsConfiguration(catalog: MrsPricingCatalog, input: MrsEstimateInput): MrsEstimate | null {
  const tier = findMrsTier(catalog, input.clusterType, input.nodeType);
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
        label: `${quantity} x ${input.nodeType} (${input.clusterType})`,
        amount,
      },
    ],
    notes: [`Node rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(2)}/node/h.`],
  };
}
