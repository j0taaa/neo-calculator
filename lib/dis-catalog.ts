import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DisType = "General" | "Advanced";

export type DisRateSet = PricingRateSet<"ONDEMAND">;

export interface DisInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  type: string;
  usageFactor: string;
}

export interface DisPricingCatalog extends RegionalPricingCatalog {
  tiers: DisInstanceTier[];
}

export interface DisEstimateInput {
  type: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use";
}

export interface DisEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DisEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: DisInstanceTier;
  productId: string | null;
  breakdown: DisEstimateBreakdownItem[];
  notes: string[];
}

export const disDefaults = {
  type: "General",
  quantity: 1,
  usageHours: 744,
} as const;

export const disPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/dis",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/dis.html",
} as const;

const typeOrder = ["General", "Advanced"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listDisTypes(catalog: DisPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.type);
    }
  }
  return orderedSet(values, typeOrder);
}

export function findDisTier(catalog: DisPricingCatalog, type: string): DisInstanceTier | null {
  return catalog.tiers.find((tier) => tier.type === type && tier.usageFactor === "inputunitnum") ?? null;
}

export function estimateDisConfiguration(catalog: DisPricingCatalog, input: DisEstimateInput): DisEstimate | null {
  const tier = findDisTier(catalog, input.type);
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
        label: `${quantity} x ${input.type}`,
        amount,
      },
    ],
    notes: [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(2)}/instance/h.`],
  };
}
