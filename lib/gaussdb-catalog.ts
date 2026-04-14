import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type GaussDbEdition = "Basic Edition" | "Advanced Edition";

export type GaussDbRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface GaussDbInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  dbEdition: string;
  specification: string;
  vCpus: number;
  memoryGb: number;
}

export interface GaussDbPricingCatalog extends RegionalPricingCatalog {
  tiers: GaussDbInstanceTier[];
}

export interface GaussDbEstimateInput {
  dbEdition: string;
  specification: string;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
}

export interface GaussDbEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface GaussDbEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  billingMode: string;
  tier: GaussDbInstanceTier;
  breakdown: GaussDbEstimateBreakdownItem[];
  notes: string[];
}

export const gaussDbDefaults = {
  dbEdition: "Basic Edition" as const,
  specification: "4 vCPUs, 16 GB",
  quantity: 1,
  usageHours: 744,
  billingMode: "Pay-per-use" as const,
} as const;

export const gaussDbPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/gaussdb",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/gaussdb.html",
} as const;

const editionOrder: string[] = ["Basic Edition", "Advanced Edition"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listGaussDbEditions(catalog: GaussDbPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.dbEdition);
    }
  }
  return orderedSet(values, editionOrder);
}

export function listGaussDbSpecifications(catalog: GaussDbPricingCatalog, dbEdition: string): string[] {
  return catalog.tiers
    .filter((tier) => tier.dbEdition === dbEdition && tier.prices.ONDEMAND != null)
    .sort((left, right) => {
      if (left.vCpus !== right.vCpus) return left.vCpus - right.vCpus;
      return left.memoryGb - right.memoryGb;
    })
    .map((tier) => tier.specification);
}

export function findGaussDbTier(catalog: GaussDbPricingCatalog, dbEdition: string, specification: string): GaussDbInstanceTier | null {
  return catalog.tiers.find((tier) => tier.dbEdition === dbEdition && tier.specification === specification) ?? null;
}

export function estimateGaussDbConfiguration(catalog: GaussDbPricingCatalog, input: GaussDbEstimateInput): GaussDbEstimate | null {
  const tier = findGaussDbTier(catalog, input.dbEdition, input.specification);
  if (!tier) {
    return null;
  }

  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }

  const quantity = Math.floor(input.quantity);

  if (input.billingMode === "Pay-per-use") {
    if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
      return null;
    }
    if (tier.prices.ONDEMAND == null) {
      return null;
    }

    const usageHours = Math.floor(input.usageHours);
    const instanceAmount = tier.prices.ONDEMAND * quantity * usageHours;
    const amount = roundAmount(instanceAmount);

    return {
      currency: catalog.currency,
      amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: roundAmount(amount / (usageHours / (24 * 30))),
      quantity,
      usageHours,
      billingMode: "Pay-per-use",
      tier,
      breakdown: [
        {
          label: `${quantity} x ${input.dbEdition} ${input.specification}`,
          amount: roundAmount(instanceAmount),
        },
      ],
      notes: [
        `Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(6)}/instance/h.`,
      ],
    };
  }

  if (input.billingMode === "Yearly/Monthly") {
    const monthlyRate = tier.prices.MONTHLY;
    const yearlyRate = tier.prices.YEARLY;

    if (monthlyRate == null && yearlyRate == null) {
      return null;
    }

    const rate = monthlyRate ?? 0;
    const amount = roundAmount(rate * quantity);

    return {
      currency: catalog.currency,
      amount,
      suffix: "/mo",
      monthlyAverageAmount: amount,
      quantity,
      usageHours: 0,
      billingMode: "Yearly/Monthly",
      tier,
      breakdown: [
        {
          label: `${quantity} x ${input.dbEdition} ${input.specification}`,
          amount,
        },
      ],
      notes: [
        `Monthly rate: ${catalog.currency} ${rate.toFixed(6)}/instance.`,
      ],
    };
  }

  return null;
}
