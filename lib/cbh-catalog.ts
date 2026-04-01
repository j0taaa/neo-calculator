import type { AmountPlan, RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type CbhInstanceType = "Single-node";
export type CbhEditionType = "Standard" | "Professional";
export type CbhBillingMode = "MONTHLY" | "YEARLY";

export interface CbhPlan extends AmountPlan<CbhBillingMode> {
  productId: string | null;
}

export interface CbhEditionTier {
  instanceType: CbhInstanceType;
  edition: string;
  editionType: CbhEditionType;
  assetCount: number;
  resourceSpecCode: string;
  plans: CbhPlan[];
}

export interface CbhPricingCatalog extends RegionalPricingCatalog {
  editionTiers: CbhEditionTier[];
}

export interface CbhEstimateInput {
  instanceType: CbhInstanceType;
  edition: string;
  durationMonths: number;
  quantity: number;
}

export interface CbhEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  durationMonths: number;
  tier: CbhEditionTier;
  selectedPlan: CbhPlan;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const cbhDefaults = {
  instanceType: "Single-node" as CbhInstanceType,
  edition: "Standard 50",
  durationMonths: 1,
  quantity: 1,
} as const;

export const cbhPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/cbh",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/cbh.html",
} as const;

const instanceTypeOrder: CbhInstanceType[] = ["Single-node"];
const editionTypeOrder: CbhEditionType[] = ["Standard", "Professional"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function normalizeDurationMonths(value: number) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : NaN;
  if ((parsed >= 1 && parsed <= 9) || parsed === 12 || parsed === 24 || parsed === 36) {
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

export function listCbhInstanceTypes(catalog: CbhPricingCatalog) {
  const values = new Set<CbhInstanceType>();
  for (const tier of catalog.editionTiers) {
    if (tier.plans.length > 0) {
      values.add(tier.instanceType);
    }
  }
  return instanceTypeOrder.filter((entry) => values.has(entry));
}

export function listCbhEditions(catalog: CbhPricingCatalog, instanceType: CbhInstanceType) {
  return catalog.editionTiers
    .filter((tier) => tier.instanceType === instanceType && tier.plans.length > 0)
    .sort((left, right) => {
      if (left.assetCount !== right.assetCount) {
        return left.assetCount - right.assetCount;
      }
      return editionTypeOrder.indexOf(left.editionType) - editionTypeOrder.indexOf(right.editionType);
    })
    .map((tier) => tier.edition);
}

export function listCbhDurationMonths(catalog: CbhPricingCatalog, instanceType: CbhInstanceType, edition: string) {
  const tier = catalog.editionTiers.find((entry) => entry.instanceType === instanceType && entry.edition === edition) ?? null;
  if (!tier) {
    return [1, 12];
  }

  const options = new Set<number>([1, 2, 3, 4, 5, 6, 7, 8, 9, 12]);
  for (const plan of tier.plans) {
    if (plan.billingMode === "YEARLY" && (plan.periodNum === 2 || plan.periodNum === 3)) {
      options.add(plan.periodNum * 12);
    }
  }
  return [...options].sort((left, right) => left - right);
}

export function findCbhEditionTier(catalog: CbhPricingCatalog, options: { instanceType: CbhInstanceType; edition: string }) {
  return catalog.editionTiers.find((entry) => entry.instanceType === options.instanceType && entry.edition === options.edition) ?? null;
}

function findMonthlyPlan(tier: CbhEditionTier) {
  return tier.plans.find((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1) ?? null;
}

function findYearlyPlan(tier: CbhEditionTier, years: number) {
  return tier.plans.find((plan) => plan.billingMode === "YEARLY" && plan.periodNum === years) ?? null;
}

export function estimateCbhConfiguration(catalog: CbhPricingCatalog, input: CbhEstimateInput): CbhEstimate | null {
  const tier = findCbhEditionTier(catalog, input);
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

  let selectedPlan: CbhPlan | null = null;
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
      notes.push("Durations from 2 to 9 months are extrapolated from the direct 1-month Huawei rate because the catalog exposes only the 1-month monthly plan.");
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
  const suffix = durationMonths === 1
    ? "/mo"
    : durationMonths === 12
      ? "/1yr"
      : durationMonths === 24
        ? "/2yr"
        : durationMonths === 36
          ? "/3yr"
          : `/${durationMonths}mo`;

  notes.push("Pricing uses the direct Huawei Cloud Bastion Host rates from the cbh calculator catalog.");

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
        label: `${quantity} x ${tier.edition} for ${durationLabel}`,
        amount,
      },
    ],
    notes,
  };
}
