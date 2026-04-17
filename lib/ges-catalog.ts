import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type GesGraphSize = string;

export type GesRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface GesInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  graphSize: string;
}

export interface GesPricingCatalog extends RegionalPricingCatalog {
  tiers: GesInstanceTier[];
}

export interface GesEstimateInput {
  graphSize: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
}

export interface GesEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface GesEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: GesInstanceTier;
  productId: string | null;
  breakdown: GesEstimateBreakdownItem[];
  notes: string[];
}

export const gesDefaults = {
  graphSize: "10 thousand edges",
  quantity: 1,
  usageHours: 744,
} as const;

export const gesPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/ges",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/ges.html",
} as const;

const graphSizeOrder = [
  "10 thousand edges",
  "million edges",
  "10 million edges",
  "100 million edges",
  "billion edges",
  "10billion edges",
];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listGesGraphSizes(catalog: GesPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null || tier.prices.MONTHLY != null || tier.prices.YEARLY != null) {
      values.add(tier.graphSize);
    }
  }
  return orderedSet(values, graphSizeOrder);
}

export function findGesTier(catalog: GesPricingCatalog, graphSize: string): GesInstanceTier | null {
  return catalog.tiers.find((tier) => tier.graphSize === graphSize) ?? null;
}

export function estimateGesConfiguration(catalog: GesPricingCatalog, input: GesEstimateInput): GesEstimate | null {
  const tier = findGesTier(catalog, input.graphSize);
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
        label: `${quantity} x ${input.graphSize}`,
        amount,
      },
    ],
    notes: input.billingMode === "Pay-per-use"
      ? [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND!.toFixed(2)}/instance/h.`]
      : [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY!.toFixed(2)}/instance/mo.`],
  };
}
