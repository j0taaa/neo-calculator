import type { PricingRateSet, RegionalPricingCatalog, ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type ModelArtsBillingMode = "Pay-per-use" | "Yearly/Monthly";
export type ModelArtsPricingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";
export type ModelArtsServiceType = "AI Development Lifecycle";
export type ModelArtsResourceType = "Public Resource Pool" | "Dedicated Resource Pool" | "EVS Storage";

export type ModelArtsRateSet = PricingRateSet<ModelArtsPricingMode>;

export interface ModelArtsComputeTier extends ResourcePricingTierWithProducts<ModelArtsPricingMode> {
  resourceType: Extract<ModelArtsResourceType, "Public Resource Pool" | "Dedicated Resource Pool">;
  specification: string;
  cpuUnits: number;
  memoryGiB: number | null;
}

export interface ModelArtsStorageTier extends ResourcePricingTierWithProducts<ModelArtsPricingMode> {
  resourceType: "EVS Storage";
  specification: "Instance storage";
}

export interface ModelArtsPricingCatalog extends RegionalPricingCatalog {
  serviceType: ModelArtsServiceType;
  computeTiers: ModelArtsComputeTier[];
  storageTier: ModelArtsStorageTier | null;
}

export interface ModelArtsEstimateInput {
  billingMode: ModelArtsBillingMode;
  serviceType: ModelArtsServiceType;
  resourceType: ModelArtsResourceType;
  specification: string;
  quantity: number;
  storageQuotaGb: number;
  usageHours: number;
  durationMonths: number;
}

export interface ModelArtsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface ModelArtsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  tier: ModelArtsComputeTier | ModelArtsStorageTier;
  quantity: number;
  usageHours: number | null;
  durationMonths: number | null;
  storageQuotaGb: number | null;
  hourlyAmount: number | null;
  monthlyAmount: number | null;
  yearlyAmount: number | null;
  breakdown: ModelArtsEstimateBreakdownItem[];
  notes: string[];
}

export const modelArtsDurationMonthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12] as const;

export const modelArtsDefaults = {
  serviceType: "AI Development Lifecycle" as ModelArtsServiceType,
  resourceType: "Public Resource Pool" as ModelArtsResourceType,
  specification: "Compute CPU instance (2U)",
  quantity: 1,
  storageQuotaGb: 1,
  usageHours: 744,
  durationMonths: 1,
} as const;

export const modelArtsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/modelarts",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/modelarts.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function isModelArtsResourceType(value: unknown): value is ModelArtsResourceType {
  return value === "Public Resource Pool" || value === "Dedicated Resource Pool" || value === "EVS Storage";
}

export function isModelArtsDurationMonths(value: unknown): value is (typeof modelArtsDurationMonthOptions)[number] {
  return typeof value === "number" && modelArtsDurationMonthOptions.includes(value as (typeof modelArtsDurationMonthOptions)[number]);
}

export function listModelArtsResourceTypes(catalog: ModelArtsPricingCatalog, billingMode: ModelArtsBillingMode): ModelArtsResourceType[] {
  if (billingMode === "Yearly/Monthly") {
    return catalog.computeTiers.some((tier) => tier.resourceType === "Dedicated Resource Pool" && (tier.prices.MONTHLY != null || tier.prices.YEARLY != null))
      ? ["Dedicated Resource Pool"]
      : [];
  }

  const values = new Set<ModelArtsResourceType>();
  for (const tier of catalog.computeTiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.resourceType);
    }
  }
  if (catalog.storageTier?.prices.ONDEMAND != null) {
    values.add("EVS Storage");
  }

  return ["Public Resource Pool", "Dedicated Resource Pool", "EVS Storage"].filter((value) => values.has(value as ModelArtsResourceType)) as ModelArtsResourceType[];
}

export function listModelArtsSpecifications(
  catalog: ModelArtsPricingCatalog,
  options: {
    billingMode: ModelArtsBillingMode;
    resourceType: ModelArtsResourceType;
  },
): string[] {
  if (options.resourceType === "EVS Storage") {
    return catalog.storageTier?.prices.ONDEMAND != null ? [catalog.storageTier.specification] : [];
  }

  return catalog.computeTiers
    .filter((tier) => {
      if (tier.resourceType !== options.resourceType) {
        return false;
      }

      if (options.billingMode === "Pay-per-use") {
        return tier.prices.ONDEMAND != null;
      }

      return tier.prices.MONTHLY != null || tier.prices.YEARLY != null;
    })
    .map((tier) => tier.specification);
}

export function findModelArtsComputeTier(
  catalog: ModelArtsPricingCatalog,
  resourceType: Extract<ModelArtsResourceType, "Public Resource Pool" | "Dedicated Resource Pool">,
  specification: string,
) {
  return catalog.computeTiers.find((tier) => tier.resourceType === resourceType && tier.specification === specification) ?? null;
}

export function estimateModelArtsConfiguration(catalog: ModelArtsPricingCatalog, input: ModelArtsEstimateInput): ModelArtsEstimate | null {
  if (input.serviceType !== "AI Development Lifecycle") {
    return null;
  }

  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.durationMonths) || !isModelArtsDurationMonths(Math.floor(input.durationMonths))) {
    return null;
  }
  if (!Number.isFinite(input.storageQuotaGb) || input.storageQuotaGb < 1) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  const usageHours = Math.floor(input.usageHours);
  const durationMonths = Math.floor(input.durationMonths);
  const storageQuotaGb = input.storageQuotaGb;
  const notes: string[] = [];

  if (input.resourceType === "EVS Storage") {
    if (input.billingMode !== "Pay-per-use" || !catalog.storageTier || catalog.storageTier.prices.ONDEMAND == null) {
      return null;
    }

    const hourlyAmount = catalog.storageTier.prices.ONDEMAND;
    const amount = roundAmount(hourlyAmount * storageQuotaGb * usageHours);
    const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));
    const breakdown = [
      {
        label: `${storageQuotaGb} GB instance storage`,
        amount,
      },
    ];

    notes.push(`Pay-per-use storage rate: ${catalog.currency} ${hourlyAmount.toFixed(6)}/GB/h.`);

    return {
      currency: catalog.currency,
      amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount,
      tier: catalog.storageTier,
      quantity: 1,
      usageHours,
      durationMonths: null,
      storageQuotaGb,
      hourlyAmount,
      monthlyAmount: null,
      yearlyAmount: null,
      breakdown,
      notes,
    };
  }

  const tier = findModelArtsComputeTier(catalog, input.resourceType, input.specification);
  if (!tier) {
    return null;
  }

  if (input.billingMode === "Pay-per-use") {
    if (tier.prices.ONDEMAND == null) {
      return null;
    }

    const hourlyAmount = tier.prices.ONDEMAND;
    const amount = roundAmount(hourlyAmount * quantity * usageHours);
    const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));
    const breakdown = [
      {
        label: `${quantity} x ${tier.specification}`,
        amount,
      },
    ];
    notes.push(`Pay-per-use compute rate: ${catalog.currency} ${hourlyAmount.toFixed(3)}/instance/h.`);

    return {
      currency: catalog.currency,
      amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount,
      tier,
      quantity,
      usageHours,
      durationMonths: null,
      storageQuotaGb: null,
      hourlyAmount,
      monthlyAmount: tier.prices.MONTHLY ?? null,
      yearlyAmount: tier.prices.YEARLY ?? null,
      breakdown,
      notes,
    };
  }

  if (input.resourceType !== "Dedicated Resource Pool") {
    return null;
  }

  if (durationMonths === 12) {
    if (tier.prices.YEARLY == null) {
      return null;
    }

    const yearlyAmount = tier.prices.YEARLY;
    const amount = roundAmount(yearlyAmount * quantity);
    const monthlyAverageAmount = roundAmount(amount / 12);
    const breakdown = [
      {
        label: `${quantity} x ${tier.specification} for 1 year`,
        amount,
      },
    ];

    notes.push(`Yearly compute rate: ${catalog.currency} ${yearlyAmount.toFixed(2)}/instance/yr.`);

    return {
      currency: catalog.currency,
      amount,
      suffix: "/yr",
      monthlyAverageAmount,
      tier,
      quantity,
      usageHours: null,
      durationMonths: 12,
      storageQuotaGb: null,
      hourlyAmount: tier.prices.ONDEMAND ?? null,
      monthlyAmount: tier.prices.MONTHLY ?? null,
      yearlyAmount,
      breakdown,
      notes,
    };
  }

  if (tier.prices.MONTHLY == null || !isModelArtsDurationMonths(durationMonths)) {
    return null;
  }

  const monthlyAmount = tier.prices.MONTHLY;
  const amount = roundAmount(monthlyAmount * quantity * durationMonths);
  const monthlyAverageAmount = roundAmount(amount / durationMonths);
  const breakdown = [
    {
      label: `${quantity} x ${tier.specification} for ${durationMonths} month${durationMonths === 1 ? "" : "s"}`,
      amount,
    },
  ];

  notes.push(`Monthly compute rate: ${catalog.currency} ${monthlyAmount.toFixed(2)}/instance/mo.`);

  return {
    currency: catalog.currency,
    amount,
    suffix: durationMonths === 1 ? "/mo" : `/${durationMonths}mo`,
    monthlyAverageAmount,
    tier,
    quantity,
    usageHours: null,
    durationMonths,
    storageQuotaGb: null,
    hourlyAmount: tier.prices.ONDEMAND ?? null,
    monthlyAmount,
    yearlyAmount: tier.prices.YEARLY ?? null,
    breakdown,
    notes,
  };
}
