import { orderedSet, type RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type DirectConnectPortSpeed = "1GE" | "10GE" | "40GE" | "100GE";
export type DirectConnectBillingMode = "MONTHLY" | "YEARLY";

export interface DirectConnectPlan {
  billingMode: DirectConnectBillingMode;
  periodNum: number;
  amount: number;
  productId: string | null;
}

export interface DirectConnectPortTier {
  portSpeed: DirectConnectPortSpeed;
  resourceSpecCode: string;
  plans: DirectConnectPlan[];
}

export interface DirectConnectPricingCatalog extends RegionalPricingCatalog {
  portTiers: DirectConnectPortTier[];
}

export interface DirectConnectEstimateInput {
  portSpeed: DirectConnectPortSpeed;
  durationMonths: number;
  quantity: number;
}

export interface DirectConnectEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  durationMonths: number;
  tier: DirectConnectPortTier;
  selectedPlan: DirectConnectPlan;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const directConnectDefaults = {
  portSpeed: "1GE" as DirectConnectPortSpeed,
  durationMonths: 1,
  quantity: 1,
} as const;

export const directConnectPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/dline",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
} as const;

const speedOrder: DirectConnectPortSpeed[] = ["1GE", "10GE", "40GE", "100GE"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function normalizeDurationMonths(value: number) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : NaN;
  if (parsed <= 11 || parsed === 12 || parsed === 24 || parsed === 36) {
    return parsed;
  }
  return null;
}

function getDurationLabel(durationMonths: number) {
  if (durationMonths === 12) {
    return "1 year";
  }
  if (durationMonths === 24) {
    return "2 years";
  }
  if (durationMonths === 36) {
    return "3 years";
  }
  return `${durationMonths} month${durationMonths === 1 ? "" : "s"}`;
}

export function listDirectConnectPortSpeeds(catalog: DirectConnectPricingCatalog) {
  const values = new Set<DirectConnectPortSpeed>();
  for (const tier of catalog.portTiers) {
    if (tier.plans.length > 0) {
      values.add(tier.portSpeed);
    }
  }
  return orderedSet(values, speedOrder);
}

export function listDirectConnectDurationMonths(catalog: DirectConnectPricingCatalog, portSpeed: DirectConnectPortSpeed) {
  const tier = catalog.portTiers.find((entry) => entry.portSpeed === portSpeed) ?? null;
  if (!tier) {
    return [1, 12];
  }
  const options = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const plan of tier.plans) {
    if (plan.billingMode === "YEARLY" && (plan.periodNum === 2 || plan.periodNum === 3)) {
      options.add(plan.periodNum * 12);
    }
  }
  return [...options].sort((left, right) => left - right);
}

export function findDirectConnectTier(catalog: DirectConnectPricingCatalog, portSpeed: DirectConnectPortSpeed) {
  return catalog.portTiers.find((entry) => entry.portSpeed === portSpeed) ?? null;
}

function findMonthlyPlan(tier: DirectConnectPortTier) {
  return tier.plans.find((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1) ?? null;
}

function findYearlyPlan(tier: DirectConnectPortTier, years: number) {
  return tier.plans.find((plan) => plan.billingMode === "YEARLY" && plan.periodNum === years) ?? null;
}

export function estimateDirectConnectConfiguration(catalog: DirectConnectPricingCatalog, input: DirectConnectEstimateInput): DirectConnectEstimate | null {
  const tier = findDirectConnectTier(catalog, input.portSpeed);
  if (!tier) {
    return null;
  }

  const durationMonths = normalizeDurationMonths(input.durationMonths);
  if (durationMonths == null) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  const durationLabel = getDurationLabel(durationMonths);

  let selectedPlan: DirectConnectPlan | null = null;
  let unitAmount = 0;
  const notes: string[] = [];

  if (durationMonths < 12) {
    const monthlyPlan = findMonthlyPlan(tier);
    if (!monthlyPlan) {
      return null;
    }
    selectedPlan = monthlyPlan;
    unitAmount = monthlyPlan.amount * durationMonths;
    if (durationMonths > 1) {
      notes.push("Durations from 2 to 11 months are extrapolated from the direct 1-month Huawei rate because the catalog exposes only the 1-month monthly plan.");
    }
  } else {
    const yearlyPlan = findYearlyPlan(tier, durationMonths / 12);
    if (!yearlyPlan) {
      return null;
    }
    selectedPlan = yearlyPlan;
    unitAmount = yearlyPlan.amount;
  }

  const amount = roundAmount(unitAmount * quantity);
  const monthlyAverageAmount = roundAmount(amount / durationMonths);
  const suffix = durationMonths === 1 ? "/mo" : durationMonths === 12 ? "/1yr" : durationMonths === 24 ? "/2yr" : durationMonths === 36 ? "/3yr" : `/${durationMonths}mo`;

  notes.push("Pricing uses the direct Huawei Direct Connect port rates from the dline calculator catalog.");

  return {
    currency: catalog.currency,
    amount,
    suffix,
    monthlyAverageAmount,
    quantity,
    durationMonths,
    tier,
    selectedPlan,
    breakdown: [
      {
        label: `${quantity} x ${input.portSpeed} port for ${durationLabel}`,
        amount,
      },
    ],
    notes,
  };
}
