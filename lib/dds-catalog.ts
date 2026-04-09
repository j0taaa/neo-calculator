import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DdsRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface DdsInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  dbType: string;
  specification: string;
  vCpus: number;
  memoryGb: number;
}

export interface DdsPricingCatalog extends RegionalPricingCatalog {
  tiers: DdsInstanceTier[];
}

export interface DdsEstimateInput {
  dbType: string;
  specification: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
}

export interface DdsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DdsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: DdsInstanceTier;
  productId: string | null;
  breakdown: DdsEstimateBreakdownItem[];
  notes: string[];
}

export const ddsDefaults = {
  dbType: "Replica set",
  specification: "2 vCPUs | 4 GB",
  quantity: 1,
  usageHours: 744,
} as const;

export const ddsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/dds",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/dds.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listDdsDbTypes(catalog: DdsPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null || tier.prices.MONTHLY != null || tier.prices.YEARLY != null) {
      values.add(tier.dbType);
    }
  }
  return orderedSet(values, ["Replica set", "Cluster", "Shard", "Mongos", "Config"]);
}

export function listDdsSpecifications(catalog: DdsPricingCatalog, dbType: string): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.dbType === dbType && (tier.prices.ONDEMAND != null || tier.prices.MONTHLY != null || tier.prices.YEARLY != null)) {
      values.add(tier.specification);
    }
  }
  return [...values].sort((a, b) => {
    const aNum = Number.parseFloat(a);
    const bNum = Number.parseFloat(b);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  });
}

export function findDdsTier(catalog: DdsPricingCatalog, dbType: string, specification: string): DdsInstanceTier | null {
  return catalog.tiers.find((tier) => tier.dbType === dbType && tier.specification === specification) ?? null;
}

export function estimateDdsConfiguration(catalog: DdsPricingCatalog, input: DdsEstimateInput): DdsEstimate | null {
  const tier = findDdsTier(catalog, input.dbType, input.specification);
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
        label: `${quantity} x ${input.dbType} - ${input.specification}`,
        amount,
      },
    ],
    notes: input.billingMode === "Pay-per-use"
      ? [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND!.toFixed(2)}/instance/h.`]
      : [`Monthly rate: ${catalog.currency} ${tier.prices.MONTHLY!.toFixed(2)}/instance/mo.`],
  };
}
