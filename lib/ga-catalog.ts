import { huaweiRegions } from "@/lib/huawei-regions";
import type { RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export interface GaAcceleratorTier {
  resourceSpecCode: string;
  hourlyRate: number | null;
  productId: string | null;
}

export interface GaTrafficTier {
  resourceSpecCode: string;
  accessPoint: string;
  destinationEndpoint: string;
  ratePerGb: number | null;
  productId: string | null;
}

export interface GaPricingCatalog extends RegionalPricingCatalog {
  acceleratorTiers: GaAcceleratorTier[];
  trafficTiers: GaTrafficTier[];
}

export interface GaEstimateInput {
  regionValue: string;
  accessPoint: string;
  trafficGb: number;
  usageHours: number;
  quantity: number;
}

export interface GaEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  destinationEndpoint: string;
  accessPoint: string;
  trafficGb: number;
  usageHours: number;
  quantity: number;
  acceleratorTier: GaAcceleratorTier;
  trafficTier: GaTrafficTier;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const gaDefaults = {
  accessPoint: "Brazil",
  trafficGb: 0,
  usageHours: 744,
  quantity: 1,
} as const;

export const gaPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/ga",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/ga.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function normalizeEndpointLabel(value: string) {
  return value.toLowerCase().replaceAll(/\s+/g, "");
}

export function getGaDestinationEndpointForRegion(regionValue: string) {
  if (regionValue in huaweiRegions) {
    return huaweiRegions[regionValue as keyof typeof huaweiRegions].short;
  }

  return null;
}

export function listGaAccessPoints(catalog: GaPricingCatalog, regionValue: string) {
  const destinationEndpoint = getGaDestinationEndpointForRegion(regionValue);
  if (!destinationEndpoint) {
    return [];
  }

  const destinationKey = normalizeEndpointLabel(destinationEndpoint);
  const values = new Set<string>();
  for (const tier of catalog.trafficTiers) {
    if (
      tier.ratePerGb != null
      && normalizeEndpointLabel(tier.destinationEndpoint) === destinationKey
    ) {
      values.add(tier.accessPoint);
    }
  }

  return [...values].sort((left, right) => left.localeCompare(right));
}

function getPrimaryAcceleratorTier(catalog: GaPricingCatalog) {
  return catalog.acceleratorTiers.find((tier) => tier.hourlyRate != null && tier.hourlyRate > 0) ?? null;
}

function findTrafficTier(catalog: GaPricingCatalog, regionValue: string, accessPoint: string) {
  const destinationEndpoint = getGaDestinationEndpointForRegion(regionValue);
  if (!destinationEndpoint) {
    return null;
  }

  const destinationKey = normalizeEndpointLabel(destinationEndpoint);
  const accessPointKey = normalizeEndpointLabel(accessPoint);

  return catalog.trafficTiers.find((tier) => (
    tier.ratePerGb != null
    && normalizeEndpointLabel(tier.destinationEndpoint) === destinationKey
    && normalizeEndpointLabel(tier.accessPoint) === accessPointKey
  )) ?? null;
}

export function estimateGaConfiguration(catalog: GaPricingCatalog, input: GaEstimateInput): GaEstimate | null {
  const acceleratorTier = getPrimaryAcceleratorTier(catalog);
  if (!acceleratorTier || acceleratorTier.hourlyRate == null) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.trafficGb) || input.trafficGb < 0) {
    return null;
  }

  const destinationEndpoint = getGaDestinationEndpointForRegion(input.regionValue);
  if (!destinationEndpoint) {
    return null;
  }

  const trafficTier = findTrafficTier(catalog, input.regionValue, input.accessPoint);
  if (!trafficTier || trafficTier.ratePerGb == null) {
    return null;
  }

  const usageHours = Math.floor(input.usageHours);
  const quantity = Math.floor(input.quantity);
  const trafficGb = roundAmount(input.trafficGb);
  const acceleratorAmount = roundAmount(acceleratorTier.hourlyRate * usageHours * quantity);
  const trafficAmount = roundAmount(trafficTier.ratePerGb * trafficGb * quantity);
  const amount = roundAmount(acceleratorAmount + trafficAmount);
  const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${usageHours}h`,
    monthlyAverageAmount,
    destinationEndpoint,
    accessPoint: trafficTier.accessPoint,
    trafficGb,
    usageHours,
    quantity,
    acceleratorTier,
    trafficTier,
    breakdown: [
      {
        label: `${quantity} x accelerator instance for ${usageHours}h`,
        amount: acceleratorAmount,
      },
      ...(trafficGb > 0
        ? [{
            label: `${quantity} x ${trafficTier.accessPoint} -> ${trafficTier.destinationEndpoint} traffic ${trafficGb} GB`,
            amount: trafficAmount,
          }]
        : []),
    ],
    notes: [
      `Accelerator instance rate: ${catalog.currency} ${acceleratorTier.hourlyRate.toFixed(6)}/h.`,
      `Traffic rate from ${trafficTier.accessPoint} to ${trafficTier.destinationEndpoint}: ${catalog.currency} ${trafficTier.ratePerGb.toFixed(6)}/GB.`,
    ],
  };
}
