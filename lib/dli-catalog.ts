import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DliRateSet = PricingRateSet<"MONTHLY" | "YEARLY">;

export interface DliInstanceTier extends ResourcePricingTierWithProducts<"MONTHLY" | "YEARLY"> {
  billingItem: string;
  specification: string;
}

export interface DliPricingCatalog extends RegionalPricingCatalog {
  tiers: DliInstanceTier[];
}

const billingItemOrder = ["Internal Table", "Scan", "Resource Pool"];

export interface DliEstimateInput {
  billingItem: string;
  specification: string;
  quantity: number;
  billingMode: "Yearly/Monthly";
}

export interface DliEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DliEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  tier: DliInstanceTier;
  productId: string | null;
  breakdown: DliEstimateBreakdownItem[];
  notes: string[];
}

export const dliDefaults = {
  billingItem: "Scan",
  specification: "Package",
  quantity: 1,
} as const;

export const dliPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/dli",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/dli.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listDliBillingItems(catalog: DliPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.MONTHLY != null || tier.prices.YEARLY != null) {
      values.add(tier.billingItem);
    }
  }
  return orderedSet(values, billingItemOrder);
}

export function listDliSpecifications(catalog: DliPricingCatalog, billingItem: string): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.billingItem === billingItem && (tier.prices.MONTHLY != null || tier.prices.YEARLY != null)) {
      values.add(tier.specification);
    }
  }
  return [...values].sort();
}

export function findDliTier(catalog: DliPricingCatalog, billingItem: string, specification: string): DliInstanceTier | null {
  return catalog.tiers.find((tier) => tier.billingItem === billingItem && tier.specification === specification) ?? null;
}

export function estimateDliConfiguration(catalog: DliPricingCatalog, input: DliEstimateInput): DliEstimate | null {
  const tier = findDliTier(catalog, input.billingItem, input.specification);
  if (!tier) return null;

  const quantity = Math.max(1, Math.floor(input.quantity));

  let amount: number;
  let suffix: string;
  let productId: string | null = null;

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

  const monthlyAverageAmount = amount;

  return {
    currency: catalog.currency,
    amount,
    suffix,
    monthlyAverageAmount,
    quantity,
    tier,
    productId,
    breakdown: [
      {
        label: `${quantity} x ${input.billingItem} - ${input.specification}`,
        amount,
      },
    ],
    notes: [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY!.toFixed(2)}/mo.`],
  };
}
