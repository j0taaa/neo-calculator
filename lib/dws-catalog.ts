import type { PricingRateSet, RegionalPricingCatalog, ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DwsRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface DwsInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  specification: string;
}

export interface DwsPricingCatalog extends RegionalPricingCatalog {
  tiers: DwsInstanceTier[];
}

export const dwsStorageTypeOptions = [
  "Ultra-high I/O",
  "High I/O",
  "Common I/O",
];

export interface DwsEstimateInput {
  specification: string;
  storageType: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
}

export interface DwsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DwsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: DwsInstanceTier;
  productId: string | null;
  breakdown: DwsEstimateBreakdownItem[];
  notes: string[];
}

export const dwsDefaults = {
  specification: "dwsx.8xlarge",
  storageType: "Ultra-high I/O",
  quantity: 1,
  usageHours: 744,
} as const;

export const dwsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/dws",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/dws.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listDwsSpecifications(catalog: DwsPricingCatalog, billingMode?: "Pay-per-use" | "Yearly/Monthly"): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    const hasOnDemand = tier.prices.ONDEMAND != null;
    const hasMonthly = tier.prices.MONTHLY != null;
    const hasYearly = tier.prices.YEARLY != null;
    
    if (billingMode === "Pay-per-use") {
      if (!hasOnDemand) continue;
    } else if (billingMode === "Yearly/Monthly") {
      if (!hasMonthly && !hasYearly) continue;
    } else {
      if (!hasOnDemand && !hasMonthly && !hasYearly) continue;
    }
    
    values.add(tier.specification);
  }
  return [...values].sort();
}

export function findDwsTier(catalog: DwsPricingCatalog, specification: string): DwsInstanceTier | null {
  return catalog.tiers.find((tier) => tier.specification === specification) ?? null;
}

export function estimateDwsConfiguration(catalog: DwsPricingCatalog, input: DwsEstimateInput): DwsEstimate | null {
  const tier = findDwsTier(catalog, input.specification);
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

  const breakdownLabel = input.storageType
    ? `${quantity} x ${input.specification} (${input.storageType})`
    : `${quantity} x ${input.specification}`;

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
        label: breakdownLabel,
        amount,
      },
    ],
    notes: input.billingMode === "Pay-per-use"
      ? [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND!.toFixed(2)}/instance/h.`]
      : [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY!.toFixed(2)}/instance/mo.`],
  };
}
