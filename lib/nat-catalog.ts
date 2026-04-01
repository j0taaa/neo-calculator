import type { PricingRateSet, RegionalPricingCatalog, ResourcePricingTier } from "@/lib/pricing-catalog-types";

export type NatGatewayType = "Public NAT Gateway" | "Private NAT Gateway";
export type NatGatewaySize = "Small" | "Medium" | "Large" | "Extra-large";
export type NatPricingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

export type NatRateSet = PricingRateSet<NatPricingMode>;

export interface NatPricingTier extends ResourcePricingTier<NatPricingMode> {
  type: NatGatewayType;
  size: NatGatewaySize;
}

export interface NatPricingCatalog extends RegionalPricingCatalog {
  tiers: NatPricingTier[];
}

export interface NatEstimateInput {
  type: NatGatewayType;
  size: NatGatewaySize;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
  usageHours: number;
}

export interface NatEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  tier: NatPricingTier;
  hourlyAmount: number | null;
  dailyAmount: number | null;
  monthlyAmount: number | null;
  yearlyAmount: number | null;
  billableDays: number | null;
  notes: string[];
}

const DEFAULT_CURRENCY = "USD";
const DEFAULT_REGION = "ap-southeast-1";
const DEFAULT_TYPE: NatGatewayType = "Public NAT Gateway";
const DEFAULT_SIZE: NatGatewaySize = "Small";

const fallbackCatalog: NatPricingCatalog = {
  currency: DEFAULT_CURRENCY,
  regionId: DEFAULT_REGION,
  tiers: [],
};

function roundNatAmount(value: number) {
  return Number(value.toFixed(5));
}

export const natPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/nat",
  specsUrl: "https://support.huaweicloud.com/intl/en-us/productdesc-natgateway/en-us_topic_0086739763.html",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
} as const;

export const natDefaults = {
  type: DEFAULT_TYPE,
  size: DEFAULT_SIZE,
} as const;

export const natGatewayTypeOptions = ["Public NAT Gateway", "Private NAT Gateway"] as const satisfies readonly NatGatewayType[];
export const natGatewaySizeOptions = ["Small", "Medium", "Large", "Extra-large"] as const satisfies readonly NatGatewaySize[];

export function getFallbackNatPricingCatalog(): NatPricingCatalog {
  return fallbackCatalog;
}

export function listNatGatewayTypes(catalog: NatPricingCatalog = fallbackCatalog): NatGatewayType[] {
  const values = new Set<NatGatewayType>();
  for (const tier of catalog.tiers) {
    values.add(tier.type);
  }

  return natGatewayTypeOptions.filter((value) => values.size === 0 || values.has(value));
}

export function listNatGatewaySizes(type?: NatGatewayType, catalog: NatPricingCatalog = fallbackCatalog): NatGatewaySize[] {
  const values = new Set<NatGatewaySize>();
  for (const tier of catalog.tiers) {
    if (!type || tier.type === type) {
      values.add(tier.size);
    }
  }

  return natGatewaySizeOptions.filter((value) => values.size === 0 || values.has(value));
}

export function getNatPrice(
  type: NatGatewayType,
  size: NatGatewaySize,
  catalog: NatPricingCatalog = fallbackCatalog,
): NatPricingTier | null {
  return catalog.tiers.find((tier) => tier.type === type && tier.size === size) ?? null;
}

export function estimateNatConfiguration(catalog: NatPricingCatalog, input: NatEstimateInput): NatEstimate | null {
  const tier = getNatPrice(input.type, input.size, catalog);
  if (!tier) {
    return null;
  }

  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }

  const usageHours = input.usageHours;
  const dailyAmount = input.type === "Public NAT Gateway" ? tier.prices.ONDEMAND ?? null : null;
  const hourlyAmount = input.type === "Private NAT Gateway" ? tier.prices.ONDEMAND ?? null : null;
  const monthlyAmount = tier.prices.MONTHLY ?? null;
  const yearlyAmount = tier.prices.YEARLY ?? null;
  const notes: string[] = [];

  if (input.billingMode === "Pay-per-use") {
    if (input.type === "Public NAT Gateway") {
      if (dailyAmount == null) {
        return null;
      }

      const billableDays = Math.max(1, Math.ceil(usageHours / 24));
      const amount = roundNatAmount(dailyAmount * billableDays);
      notes.push("Public NAT Gateway pay-per-use pricing is billed by day. Partial-day usage is rounded up to the next billable day.");
      return {
        currency: catalog.currency,
        amount,
        suffix: `/${billableDays}d`,
        monthlyAverageAmount: roundNatAmount(amount / (billableDays / 30)),
        tier,
        hourlyAmount: null,
        dailyAmount,
        monthlyAmount,
        yearlyAmount,
        billableDays,
        notes,
      };
    }

    if (hourlyAmount == null) {
      return null;
    }

    const amount = roundNatAmount(hourlyAmount * usageHours);
    notes.push("Private NAT Gateway pay-per-use pricing is billed by hour in the live Huawei calculator catalog.");
    return {
      currency: catalog.currency,
      amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: roundNatAmount(amount / (usageHours / (24 * 30))),
      tier,
      hourlyAmount,
      dailyAmount: null,
      monthlyAmount,
      yearlyAmount,
      billableDays: null,
      notes,
    };
  }

  if (input.type === "Private NAT Gateway") {
    return null;
  }

  if (monthlyAmount == null) {
    return null;
  }

  return {
    currency: catalog.currency,
    amount: roundNatAmount(monthlyAmount),
    suffix: "/mo",
    monthlyAverageAmount: roundNatAmount(monthlyAmount),
    tier,
    hourlyAmount,
    dailyAmount,
    monthlyAmount,
    yearlyAmount,
    billableDays: null,
    notes,
  };
}
