import type { AmountPlan, RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type CbrUiBillingMode = "Pay-per-use" | "Yearly/Monthly";
export type CbrBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

export interface CbrPlan extends AmountPlan<CbrBillingMode> {
  productId: string | null;
}

export interface CbrVaultTier {
  vaultType: string;
  resourceSpecCode: string;
  plans: CbrPlan[];
}

export interface CbrPricingCatalog extends RegionalPricingCatalog {
  vaultTiers: CbrVaultTier[];
}

export interface CbrEstimateInput {
  billingMode: CbrUiBillingMode;
  vaultType: string;
  vaultCapacityGb: number;
  durationMonths: number;
  usageHours: number;
  quantity: number;
}

export interface CbrEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  vaultCapacityGb: number;
  durationMonths: number | null;
  usageHours: number | null;
  tier: CbrVaultTier;
  selectedPlan: CbrPlan;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const cbrDefaults = {
  vaultType: "Server",
  vaultCapacityGb: 100,
  durationMonths: 1,
  usageHours: 744,
  quantity: 1,
} as const;

export const cbrPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/cbr",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/cbr.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function normalizeDurationMonths(value: number) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : NaN;
  if ((parsed >= 1 && parsed <= 9) || parsed === 12 || parsed === 24 || parsed === 36 || parsed === 48 || parsed === 60) {
    return parsed;
  }
  return null;
}

function getDurationLabel(durationMonths: number) {
  if (durationMonths % 12 === 0 && durationMonths >= 12) {
    const years = durationMonths / 12;
    return `${years} year${years === 1 ? "" : "s"}`;
  }
  return `${durationMonths} month${durationMonths === 1 ? "" : "s"}`;
}

function getAverageMonthlyAmount(amount: number, usageHours: number | null) {
  if (usageHours == null) {
    return amount;
  }
  const months = usageHours / (24 * 30);
  if (!Number.isFinite(months) || months <= 0) {
    return amount;
  }
  return roundAmount(amount / months);
}

export function listCbrVaultTypes(catalog: CbrPricingCatalog) {
  return catalog.vaultTiers
    .filter((tier) => tier.plans.length > 0)
    .map((tier) => tier.vaultType)
    .sort((left, right) => left.localeCompare(right));
}

export function listCbrDurationMonths(catalog: CbrPricingCatalog, vaultType: string) {
  const tier = catalog.vaultTiers.find((entry) => entry.vaultType === vaultType) ?? null;
  if (!tier) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 24, 36, 48, 60];
  }

  const options = new Set<number>();
  if (tier.plans.some((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1)) {
    for (let month = 1; month <= 9; month += 1) {
      options.add(month);
    }
  }
  for (const plan of tier.plans) {
    if (plan.billingMode === "YEARLY" && typeof plan.periodNum === "number" && plan.periodNum >= 1 && plan.periodNum <= 5) {
      options.add(plan.periodNum * 12);
    }
  }

  return [...options].sort((left, right) => left - right);
}

export function findCbrVaultTier(catalog: CbrPricingCatalog, vaultType: string) {
  return catalog.vaultTiers.find((entry) => entry.vaultType === vaultType) ?? null;
}

function findMonthlyPlan(tier: CbrVaultTier) {
  return tier.plans.find((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1) ?? null;
}

function findYearlyPlan(tier: CbrVaultTier, years: number) {
  return tier.plans.find((plan) => plan.billingMode === "YEARLY" && plan.periodNum === years) ?? null;
}

function findOndemandPlan(tier: CbrVaultTier) {
  return tier.plans.find((plan) => plan.billingMode === "ONDEMAND") ?? null;
}

export function estimateCbrConfiguration(catalog: CbrPricingCatalog, input: CbrEstimateInput): CbrEstimate | null {
  const tier = findCbrVaultTier(catalog, input.vaultType);
  if (!tier) {
    return null;
  }
  if (!Number.isFinite(input.vaultCapacityGb) || input.vaultCapacityGb <= 0) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  const vaultCapacityGb = roundAmount(input.vaultCapacityGb);
  const notes: string[] = [
    "Pricing uses the direct Huawei Cloud Backup and Recovery vault rates from the cbr calculator catalog.",
    "Replication traffic rate rows exist in the catalog but are not modeled in this vault-capacity calculator flow.",
  ];

  if (input.billingMode === "Pay-per-use") {
    if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
      return null;
    }
    const usageHours = Math.floor(input.usageHours);
    const selectedPlan = findOndemandPlan(tier);
    if (!selectedPlan) {
      return null;
    }
    const amount = roundAmount(selectedPlan.amount * vaultCapacityGb * usageHours * quantity);
    return {
      currency: catalog.currency,
      amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: getAverageMonthlyAmount(amount, usageHours),
      quantity,
      vaultCapacityGb,
      durationMonths: null,
      usageHours,
      tier,
      selectedPlan,
      breakdown: [
        {
          label: `${quantity} x ${tier.vaultType} ${vaultCapacityGb} GB for ${usageHours}h`,
          amount,
        },
      ],
      notes: [
        ...notes,
        `Hourly rate: ${catalog.currency} ${selectedPlan.amount.toFixed(6)}/GB/h.`,
      ],
    };
  }

  const durationMonths = normalizeDurationMonths(input.durationMonths);
  if (durationMonths == null) {
    return null;
  }

  let selectedPlan: CbrPlan | null = null;
  let unitAmount = 0;

  if (durationMonths < 12) {
    const monthlyPlan = findMonthlyPlan(tier);
    if (!monthlyPlan) {
      return null;
    }
    selectedPlan = monthlyPlan;
    unitAmount = monthlyPlan.amount * vaultCapacityGb * durationMonths;
    if (durationMonths > 1) {
      notes.push("Durations from 2 to 9 months are extrapolated from the direct 1-month Huawei rate because the catalog exposes only the 1-month monthly plan.");
    }
  } else {
    const yearlyPlan = findYearlyPlan(tier, durationMonths / 12);
    if (!yearlyPlan) {
      return null;
    }
    selectedPlan = yearlyPlan;
    unitAmount = yearlyPlan.amount * vaultCapacityGb;
  }

  const amount = roundAmount(unitAmount * quantity);
  const suffix = durationMonths === 1
    ? "/mo"
    : durationMonths % 12 === 0
      ? `/${durationMonths / 12}yr`
      : `/${durationMonths}mo`;

  return {
    currency: catalog.currency,
    amount,
    suffix,
    monthlyAverageAmount: roundAmount(amount / durationMonths),
    quantity,
    vaultCapacityGb,
    durationMonths,
    usageHours: null,
    tier,
    selectedPlan,
    breakdown: [
      {
        label: `${quantity} x ${tier.vaultType} ${vaultCapacityGb} GB for ${getDurationLabel(durationMonths)}`,
        amount,
      },
    ],
    notes,
  };
}
