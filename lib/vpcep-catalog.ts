import type { RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type VpcepServiceCategory = "Basic Edition";

export interface VpcepServiceTier {
  serviceCategory: VpcepServiceCategory;
  resourceSpecCode: string;
  durationRatePerHour: number | null;
  trafficRatePerGb: number | null;
  productId: string | null;
}

export interface VpcepPricingCatalog extends RegionalPricingCatalog {
  serviceTiers: VpcepServiceTier[];
}

export interface VpcepEstimateInput {
  serviceCategory: VpcepServiceCategory;
  usageHours: number;
  trafficGb: number;
  quantity: number;
}

export interface VpcepEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  trafficGb: number;
  tier: VpcepServiceTier;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const vpcepDefaults = {
  serviceCategory: "Basic Edition" as VpcepServiceCategory,
  usageHours: 744,
  trafficGb: 0,
  quantity: 1,
} as const;

export const vpcepPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/vpcep",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/vpcep.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listVpcepServiceCategories(catalog: VpcepPricingCatalog) {
  return catalog.serviceTiers
    .filter((tier) => tier.durationRatePerHour != null)
    .map((tier) => tier.serviceCategory);
}

export function findVpcepServiceTier(catalog: VpcepPricingCatalog, serviceCategory: VpcepServiceCategory) {
  return catalog.serviceTiers.find((tier) => tier.serviceCategory === serviceCategory) ?? null;
}

export function estimateVpcepConfiguration(catalog: VpcepPricingCatalog, input: VpcepEstimateInput): VpcepEstimate | null {
  const tier = findVpcepServiceTier(catalog, input.serviceCategory);
  if (!tier || tier.durationRatePerHour == null) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.trafficGb) || input.trafficGb < 0) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  const usageHours = Math.floor(input.usageHours);
  const trafficGb = roundAmount(input.trafficGb);
  const durationAmount = tier.durationRatePerHour * usageHours * quantity;
  const trafficAmount = (tier.trafficRatePerGb ?? 0) * trafficGb * quantity;
  const amount = roundAmount(durationAmount + trafficAmount);
  const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));
  const breakdown = [
    {
      label: `${quantity} x ${tier.serviceCategory} for ${usageHours}h`,
      amount: roundAmount(durationAmount),
    },
    ...(trafficGb > 0 && (tier.trafficRatePerGb ?? 0) > 0
      ? [{
          label: `${quantity} x traffic ${trafficGb} GB`,
          amount: roundAmount(trafficAmount),
        }]
      : []),
  ];

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${usageHours}h`,
    monthlyAverageAmount,
    quantity,
    usageHours,
    trafficGb,
    tier,
    breakdown,
    notes: [
      `Duration rate: ${catalog.currency} ${tier.durationRatePerHour.toFixed(6)}/endpoint/h.`,
      tier.trafficRatePerGb && tier.trafficRatePerGb > 0
        ? `Traffic rate: ${catalog.currency} ${tier.trafficRatePerGb.toFixed(6)}/GB.`
        : "The live Huawei catalog currently returns a zero traffic rate for VPCEP, so traffic does not change the estimate.",
    ],
  };
}
