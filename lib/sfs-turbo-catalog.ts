import { orderedSet, type AmountPlan, type RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type SfsTurboUiBillingMode = "Pay-per-use" | "Yearly/Monthly";
export type SfsTurboBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";
export type SfsTurboGeneration = "On Sale" | "Previous-Generation File Systems";
export type SfsTurboFileSystemType = "SFS Turbo";
export type SfsTurboType =
  | "20MB/s/TiB"
  | "40MB/s/TiB"
  | "125MB/s/TiB"
  | "250MB/s/TiB"
  | "500MB/s/TiB"
  | "1000MB/s/TiB"
  | "Standard"
  | "Performance"
  | "Standard Dedicated"
  | "Performance Dedicated";

export interface SfsTurboPlan extends AmountPlan<SfsTurboBillingMode> {
  productId: string | null;
}

export interface SfsTurboTier {
  generation: SfsTurboGeneration;
  fileSystemType: SfsTurboFileSystemType;
  type: SfsTurboType;
  resourceSpecCode: string;
  plans: SfsTurboPlan[];
}

export interface SfsTurboPricingCatalog extends RegionalPricingCatalog {
  tiers: SfsTurboTier[];
}

export interface SfsTurboEstimateInput {
  billingMode: SfsTurboUiBillingMode;
  generation: SfsTurboGeneration;
  type: SfsTurboType;
  capacityTb: number;
  durationMonths: number;
  usageHours: number;
  quantity: number;
}

export interface SfsTurboEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  capacityTb: number;
  durationMonths: number | null;
  usageHours: number | null;
  tier: SfsTurboTier;
  selectedPlan: SfsTurboPlan;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const sfsTurboDefaults = {
  fileSystemType: "SFS Turbo" as SfsTurboFileSystemType,
  generation: "On Sale" as SfsTurboGeneration,
  type: "20MB/s/TiB" as SfsTurboType,
  capacityTb: 2,
  durationMonths: 1,
  usageHours: 744,
  quantity: 1,
} as const;

export const sfsTurboPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/sfsturbo",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
} as const;

const generationOrder: SfsTurboGeneration[] = ["On Sale", "Previous-Generation File Systems"];
const typeOrder: SfsTurboType[] = [
  "20MB/s/TiB",
  "40MB/s/TiB",
  "125MB/s/TiB",
  "250MB/s/TiB",
  "500MB/s/TiB",
  "1000MB/s/TiB",
  "Standard",
  "Performance",
  "Standard Dedicated",
  "Performance Dedicated",
];
const capacityOptions = [2, 4, 8, 16, 24, 32, 48] as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function normalizeDurationMonths(value: number) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : NaN;
  if ((parsed >= 1 && parsed <= 11) || parsed === 12 || parsed === 24 || parsed === 36) {
    return parsed;
  }
  return null;
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

export function listSfsTurboGenerations(catalog: SfsTurboPricingCatalog) {
  const values = new Set<SfsTurboGeneration>();
  for (const tier of catalog.tiers) {
    values.add(tier.generation);
  }
  return orderedSet(values, generationOrder);
}

export function listSfsTurboTypes(catalog: SfsTurboPricingCatalog, generation: SfsTurboGeneration) {
  const values = new Set<SfsTurboType>();
  for (const tier of catalog.tiers) {
    if (tier.generation === generation) {
      values.add(tier.type);
    }
  }
  return orderedSet(values, typeOrder);
}

export function listSfsTurboCapacityOptions() {
  return [...capacityOptions];
}

export function findSfsTurboTier(catalog: SfsTurboPricingCatalog, input: {
  generation: SfsTurboGeneration;
  type: SfsTurboType;
}) {
  return catalog.tiers.find((tier) => tier.generation === input.generation && tier.type === input.type) ?? null;
}

export function listSfsTurboBillingOptions(catalog: SfsTurboPricingCatalog, input: {
  generation: SfsTurboGeneration;
  type: SfsTurboType;
}) {
  const tier = findSfsTurboTier(catalog, input);
  if (!tier) {
    return ["Pay-per-use", "Yearly/Monthly"] as SfsTurboUiBillingMode[];
  }

  const options: SfsTurboUiBillingMode[] = [];
  if (tier.plans.some((plan) => plan.billingMode === "ONDEMAND")) {
    options.push("Pay-per-use");
  }
  if (tier.plans.some((plan) => plan.billingMode === "MONTHLY" || plan.billingMode === "YEARLY")) {
    options.push("Yearly/Monthly");
  }
  return options;
}

export function listSfsTurboDurationMonths(catalog: SfsTurboPricingCatalog, input: {
  generation: SfsTurboGeneration;
  type: SfsTurboType;
}) {
  const tier = findSfsTurboTier(catalog, input);
  if (!tier) {
    return [1, 12];
  }
  const options = new Set<number>();
  if (tier.plans.some((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1)) {
    for (let month = 1; month <= 11; month += 1) {
      options.add(month);
    }
  }
  for (const plan of tier.plans) {
    if (plan.billingMode === "YEARLY" && (plan.periodNum === 1 || plan.periodNum === 2 || plan.periodNum === 3)) {
      options.add(plan.periodNum * 12);
    }
  }
  return [...options].sort((left, right) => left - right);
}

function findMonthlyPlan(tier: SfsTurboTier) {
  return tier.plans.find((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1) ?? null;
}

function findYearlyPlan(tier: SfsTurboTier, years: number) {
  return tier.plans.find((plan) => plan.billingMode === "YEARLY" && plan.periodNum === years) ?? null;
}

function findOndemandPlan(tier: SfsTurboTier) {
  return tier.plans.find((plan) => plan.billingMode === "ONDEMAND") ?? null;
}

export function estimateSfsTurboConfiguration(catalog: SfsTurboPricingCatalog, input: SfsTurboEstimateInput): SfsTurboEstimate | null {
  const tier = findSfsTurboTier(catalog, input);
  if (!tier) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.capacityTb) || !capacityOptions.includes(Math.floor(input.capacityTb) as typeof capacityOptions[number])) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  const capacityTb = Math.floor(input.capacityTb);
  const capacityGb = capacityTb * 1024;
  const notes = [
    "Pricing uses the direct Huawei Scalable File Service Turbo rates from the sfsturbo calculator catalog.",
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
    const amount = roundAmount(selectedPlan.amount * capacityGb * usageHours * quantity);
    return {
      currency: catalog.currency,
      amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: getAverageMonthlyAmount(amount, usageHours),
      quantity,
      capacityTb,
      durationMonths: null,
      usageHours,
      tier,
      selectedPlan,
      breakdown: [
        {
          label: `${quantity} x ${tier.type} ${capacityTb} TB for ${usageHours}h`,
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

  let selectedPlan: SfsTurboPlan | null = null;
  let unitAmount = 0;

  if (durationMonths < 12) {
    const monthlyPlan = findMonthlyPlan(tier);
    if (!monthlyPlan) {
      return null;
    }
    selectedPlan = monthlyPlan;
    unitAmount = monthlyPlan.amount * capacityGb * durationMonths;
    if (durationMonths > 1) {
      notes.push("Durations from 2 to 11 months are extrapolated from the direct 1-month Huawei package rate because the catalog exposes only the 1-month monthly plan.");
    }
  } else {
    const yearlyPlan = findYearlyPlan(tier, durationMonths / 12);
    if (!yearlyPlan) {
      return null;
    }
    selectedPlan = yearlyPlan;
    unitAmount = yearlyPlan.amount * capacityGb;
  }

  const amount = roundAmount(unitAmount * quantity);

  return {
    currency: catalog.currency,
    amount,
    suffix: durationMonths === 1 ? "/mo" : durationMonths === 12 ? "/1yr" : durationMonths === 24 ? "/2yr" : durationMonths === 36 ? "/3yr" : `/${durationMonths}mo`,
    monthlyAverageAmount: roundAmount(amount / durationMonths),
    quantity,
    capacityTb,
    durationMonths,
    usageHours: null,
    tier,
    selectedPlan,
    breakdown: [
      {
        label: `${quantity} x ${tier.type} ${capacityTb} TB for ${durationMonths === 12 ? "1 year" : durationMonths === 24 ? "2 years" : durationMonths === 36 ? "3 years" : `${durationMonths} month${durationMonths === 1 ? "" : "s"}`}`,
        amount,
      },
    ],
    notes,
  };
}
