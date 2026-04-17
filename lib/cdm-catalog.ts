import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type CdmRateSet = PricingRateSet<"ONDEMAND">;

export interface CdmInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  instanceType: string;
  vCpus: number;
  memoryGb: number;
  bandwidthGbit: string;
  maxJobs: number;
  label: string;
}

export interface CdmPricingCatalog extends RegionalPricingCatalog {
  tiers: CdmInstanceTier[];
}

export interface CdmEstimateInput {
  instanceType: string;
  quantity: number;
  usageHours: number;
}

export interface CdmEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface CdmEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: CdmInstanceTier;
  productId: string | null;
  breakdown: CdmEstimateBreakdownItem[];
  notes: string[];
}

export const cdmDefaults = {
  instanceType: "cdm.small",
  quantity: 1,
  usageHours: 744,
} as const;

export const cdmPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/cdm",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/cdm.html",
} as const;

const instanceTypeOrder = [
  "cdm.small",
  "cdm.medium",
  "cdm.large",
  "cdm.xlarge",
  "cdm.2xlarge",
  "cdm.4xlarge",
];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listCdmInstanceTypes(catalog: CdmPricingCatalog): string[] {
  const values = new Set<string>();
  for (const tier of catalog.tiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.instanceType);
    }
  }
  return orderedSet(values, instanceTypeOrder);
}

export function findCdmTier(catalog: CdmPricingCatalog, instanceType: string): CdmInstanceTier | null {
  return catalog.tiers.find((tier) => tier.instanceType === instanceType) ?? null;
}

export function estimateCdmConfiguration(catalog: CdmPricingCatalog, input: CdmEstimateInput): CdmEstimate | null {
  const tier = findCdmTier(catalog, input.instanceType);
  if (!tier || tier.prices.ONDEMAND == null) return null;

  const quantity = Math.max(1, Math.floor(input.quantity));
  const usageHours = Math.max(1, Math.floor(input.usageHours));

  const amount = roundAmount(tier.prices.ONDEMAND * quantity * usageHours);
  const productId = tier.productIds.ONDEMAND ?? null;

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${usageHours}h`,
    monthlyAverageAmount: roundAmount(amount / (usageHours / (24 * 30))),
    quantity,
    usageHours,
    tier,
    productId,
    breakdown: [
      {
        label: `${quantity} x ${tier.label}`,
        amount,
      },
    ],
    notes: [`Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(2)}/instance/h.`],
  };
}
