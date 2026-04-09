import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type CseSpecification = string;

export type CseRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface CseInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  specification: string;
}

export interface CsePricingCatalog extends RegionalPricingCatalog {
  tiers: CseInstanceTier[];
}

export interface CseEstimateInput {
  specification: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
}

export interface CseEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface CseEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: CseInstanceTier;
  productId: string | null;
  breakdown: CseEstimateBreakdownItem[];
  notes: string[];
}

export const cseDefaults = {
  specification: "cse.s1.small",
  quantity: 1,
  usageHours: 744,
} as const;

export const csePricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/cse",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/cse.html",
} as const;

const specificationOrder = [
  "cse.s1.small",
  "cse.s1.medium",
  "cse.s1.large",
  "cse.s1.xlarge",
];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listCseSpecifications(catalog: CsePricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null || tier.prices.MONTHLY != null || tier.prices.YEARLY != null) {
      values.add(tier.specification);
    }
  }
  return orderedSet(values, specificationOrder);
}

export function findCseTier(catalog: CsePricingCatalog, specification: string): CseInstanceTier | null {
  return catalog.tiers.find((tier) => tier.specification === specification) ?? null;
}

export function estimateCseConfiguration(catalog: CsePricingCatalog, input: CseEstimateInput): CseEstimate | null {
  const tier = findCseTier(catalog, input.specification);
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
        label: `${quantity} x ${input.specification}`,
        amount,
      },
    ],
    notes: input.billingMode === "Pay-per-use"
      ? [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND!.toFixed(2)}/instance/h.`]
      : [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY!.toFixed(2)}/instance/mo.`],
  };
}
