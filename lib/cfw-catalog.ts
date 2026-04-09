import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type CfwRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface CfwInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  edition: string;
}

export interface CfwPricingCatalog extends RegionalPricingCatalog {
  tiers: CfwInstanceTier[];
}

export interface CfwEstimateInput {
  edition: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
}

export interface CfwEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface CfwEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  breakdown: CfwEstimateBreakdownItem[];
  notes: string[];
}

export const cfwDefaults = {
  edition: "Standard",
  quantity: 1,
  usageHours: 744,
} as const;

export const cfwPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/cfw",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/cfw.html",
} as const;

const editionOrder = ["Standard", "Professional"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listCfwEditions(catalog: CfwPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null || tier.prices.MONTHLY != null || tier.prices.YEARLY != null) {
      values.add(tier.edition);
    }
  }
  return orderedSet(values, editionOrder);
}

export function findCfwInstanceTier(catalog: CfwPricingCatalog, edition: string): CfwInstanceTier | null {
  return catalog.tiers.find((tier) => tier.edition === edition) ?? null;
}

export function estimateCfwConfiguration(catalog: CfwPricingCatalog, input: CfwEstimateInput): CfwEstimate | null {
  const tier = findCfwInstanceTier(catalog, input.edition);
  if (!tier) return null;

  const quantity = Math.max(1, Math.floor(input.quantity));
  let amount: number;
  let suffix: string;
  let usageHours = input.usageHours ?? 0;

  if (input.billingMode === "Yearly/Monthly") {
    if (tier.prices.MONTHLY != null) {
      amount = roundAmount(tier.prices.MONTHLY * quantity);
      suffix = "/mo";
    } else if (tier.prices.YEARLY != null) {
      amount = roundAmount(tier.prices.YEARLY * quantity);
      suffix = "/yr";
    } else {
      return null;
    }
  } else {
    if (tier.prices.ONDEMAND == null) return null;
    usageHours = Math.max(1, Math.floor(input.usageHours));
    amount = roundAmount(tier.prices.ONDEMAND * quantity * usageHours);
    suffix = `/${usageHours}h`;
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
    breakdown: [
      {
        label: `${quantity} x ${input.edition}`,
        amount,
      },
    ],
    notes: input.billingMode === "Pay-per-use"
      ? [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND!.toFixed(2)}/instance/h.`]
      : [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY!.toFixed(2)}/instance/mo.`],
  };
}
