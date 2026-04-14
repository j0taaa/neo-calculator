import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DrsTaskType = "Migration" | "Synchronization" | "Subscription";
export type DrsDirection = "Upstream" | "Downstream" | "Backup";

export type DrsRateSet = PricingRateSet<"ONDEMAND">;

export interface DrsInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  taskType: string;
  direction: string;
}

export interface DrsPricingCatalog extends RegionalPricingCatalog {
  tiers: DrsInstanceTier[];
}

export interface DrsEstimateInput {
  taskType: string;
  direction: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use";
}

export interface DrsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DrsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: DrsInstanceTier;
  productId: string | null;
  breakdown: DrsEstimateBreakdownItem[];
  notes: string[];
}

export const drsDefaults = {
  taskType: "Migration",
  direction: "Upstream",
  quantity: 1,
  usageHours: 744,
} as const;

export const drsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/drs",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/drs.html",
} as const;

const taskTypeOrder = ["Migration", "Synchronization", "Subscription"];
const directionOrder = ["Upstream", "Downstream", "Backup"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listDrsTaskTypes(catalog: DrsPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.taskType);
    }
  }
  return orderedSet(values, taskTypeOrder);
}

export function listDrsDirections(catalog: DrsPricingCatalog, taskType: string): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.taskType === taskType && tier.prices.ONDEMAND != null) {
      values.add(tier.direction);
    }
  }
  return orderedSet(values, directionOrder);
}

export function findDrsTier(catalog: DrsPricingCatalog, taskType: string, direction: string): DrsInstanceTier | null {
  return catalog.tiers.find((tier) => tier.taskType === taskType && tier.direction === direction && tier.prices.ONDEMAND != null) ?? null;
}

export function estimateDrsConfiguration(catalog: DrsPricingCatalog, input: DrsEstimateInput): DrsEstimate | null {
  const tier = findDrsTier(catalog, input.taskType, input.direction);
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
        label: `${quantity} x ${input.taskType} (${input.direction})`,
        amount,
      },
    ],
    notes: [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(2)}/task/h.`],
  };
}
