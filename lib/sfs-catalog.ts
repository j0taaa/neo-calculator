import type { AmountPlan, RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type SfsUiBillingMode = "Pay-per-use" | "Yearly/Monthly";
export type SfsBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";
export type SfsFileSystemType = "General";
export type SfsType = "General" | "Capacity-Oriented";
export type SfsStorageUnit = "GB" | "TB";

export interface SfsPlan extends AmountPlan<SfsBillingMode> {
  productId: string | null;
}

export interface SfsPackageTier {
  fileSystemType: SfsFileSystemType;
  type: "Capacity-Oriented";
  storageSpaceGb: number;
  resourceSpecCode: string;
  plans: SfsPlan[];
}

export interface SfsPaygTier {
  fileSystemType: SfsFileSystemType;
  type: "General";
  resourceSpecCode: string;
  ratePerGbHour: number | null;
  productId: string | null;
}

export interface SfsPricingCatalog extends RegionalPricingCatalog {
  packageTiers: SfsPackageTier[];
  paygTiers: SfsPaygTier[];
}

export interface SfsEstimateInput {
  billingMode: SfsUiBillingMode;
  fileSystemType: SfsFileSystemType;
  type: SfsType;
  storageSpaceGb: number;
  durationMonths: number;
  usageHours: number;
  quantity: number;
}

export interface SfsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  storageSpaceGb: number;
  durationMonths: number | null;
  usageHours: number | null;
  packageTier: SfsPackageTier | null;
  paygTier: SfsPaygTier | null;
  selectedPlan: SfsPlan | null;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const sfsDefaults = {
  fileSystemType: "General" as SfsFileSystemType,
  type: "Capacity-Oriented" as SfsType,
  storageSpaceAmount: 100,
  storageSpaceUnit: "GB" as SfsStorageUnit,
  storageSpaceGb: 100,
  durationMonths: 1,
  usageHours: 744,
  quantity: 1,
} as const;

export const sfsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/sfs",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/sfs.html",
} as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function normalizeDurationMonths(value: number) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : NaN;
  if ((parsed >= 1 && parsed <= 8) || parsed === 12) {
    return parsed;
  }
  return null;
}

function getStorageLabel(storageSpaceGb: number) {
  if (storageSpaceGb >= 1024 && storageSpaceGb % 1024 === 0) {
    return `${storageSpaceGb / 1024}TB`;
  }
  return `${storageSpaceGb}GB`;
}

export function getSfsStorageUnitOptions() {
  return ["GB", "TB"] as const;
}

export function convertSfsStorageToGb(amount: number, unit: SfsStorageUnit) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const normalizedAmount = Math.floor(amount);
  return unit === "TB" ? normalizedAmount * 1024 : normalizedAmount;
}

export function inferSfsStorageUnitFromGb(storageSpaceGb: number): SfsStorageUnit {
  return storageSpaceGb >= 1024 && storageSpaceGb % 1024 === 0 ? "TB" : "GB";
}

export function inferSfsStorageAmountFromGb(storageSpaceGb: number) {
  return inferSfsStorageUnitFromGb(storageSpaceGb) === "TB" ? storageSpaceGb / 1024 : storageSpaceGb;
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

export function listSfsFileSystemTypes() {
  return ["General"] as const;
}

export function listSfsTypes(catalog: SfsPricingCatalog, billingMode: SfsUiBillingMode) {
  if (billingMode === "Pay-per-use") {
    return catalog.paygTiers.length > 0 ? ["General"] as const : [] as const;
  }
  return catalog.packageTiers.length > 0 ? ["Capacity-Oriented"] as const : [] as const;
}

export function listSfsStorageSpaceOptions(catalog: SfsPricingCatalog) {
  const values = new Set<number>();
  for (const tier of catalog.packageTiers) {
    values.add(tier.storageSpaceGb);
  }
  return [...values].sort((left, right) => left - right);
}

export function listSfsDurationMonths(catalog: SfsPricingCatalog, type: SfsType) {
  if (type !== "Capacity-Oriented") {
    return [];
  }
  const hasMonthly = catalog.packageTiers.some((tier) => tier.plans.some((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1));
  const hasYearly = catalog.packageTiers.some((tier) => tier.plans.some((plan) => plan.billingMode === "YEARLY" && plan.periodNum === 1));
  const options = new Set<number>();
  if (hasMonthly) {
    for (let month = 1; month <= 8; month += 1) {
      options.add(month);
    }
  }
  if (hasYearly) {
    options.add(12);
  }
  return [...options].sort((left, right) => left - right);
}

export function findSfsPackageTier(catalog: SfsPricingCatalog, storageSpaceGb: number) {
  return catalog.packageTiers.find((entry) => entry.storageSpaceGb === storageSpaceGb) ?? null;
}

export function findSfsPaygTier(catalog: SfsPricingCatalog) {
  return catalog.paygTiers[0] ?? null;
}

export function hasSfsPackagePricing(catalog: SfsPricingCatalog | null | undefined) {
  return Array.isArray(catalog?.packageTiers) && catalog.packageTiers.length > 0;
}

function findMonthlyPlan(tier: SfsPackageTier) {
  return tier.plans.find((plan) => plan.billingMode === "MONTHLY" && plan.periodNum === 1) ?? null;
}

function findYearlyPlan(tier: SfsPackageTier) {
  return tier.plans.find((plan) => plan.billingMode === "YEARLY" && plan.periodNum === 1) ?? null;
}

export function estimateSfsConfiguration(catalog: SfsPricingCatalog, input: SfsEstimateInput): SfsEstimate | null {
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.storageSpaceGb) || input.storageSpaceGb < 1) {
    return null;
  }
  const quantity = Math.floor(input.quantity);
  const storageSpaceGb = Math.floor(input.storageSpaceGb);

  if (input.billingMode === "Pay-per-use") {
    const paygTier = findSfsPaygTier(catalog);
    if (!paygTier || paygTier.ratePerGbHour == null || input.type !== "General") {
      return null;
    }
    if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
      return null;
    }
    const usageHours = Math.floor(input.usageHours);
    const amount = roundAmount(paygTier.ratePerGbHour * storageSpaceGb * usageHours * quantity);
    return {
      currency: catalog.currency,
      amount,
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: getAverageMonthlyAmount(amount, usageHours),
      quantity,
      storageSpaceGb,
      durationMonths: null,
      usageHours,
      packageTier: null,
      paygTier,
      selectedPlan: null,
      breakdown: [
        {
          label: `${quantity} x ${input.type} ${getStorageLabel(storageSpaceGb)} for ${usageHours}h`,
          amount,
        },
      ],
      notes: [
        "Pricing uses the direct Huawei Scalable File Service pay-per-use storage rate from the sfs calculator catalog.",
        `Hourly rate: ${catalog.currency} ${paygTier.ratePerGbHour.toFixed(6)}/GB/h.`,
      ],
    };
  }

  if (input.type !== "Capacity-Oriented") {
    return null;
  }
  const durationMonths = normalizeDurationMonths(input.durationMonths);
  if (durationMonths == null) {
    return null;
  }
  const packageTier = findSfsPackageTier(catalog, storageSpaceGb);
  if (!packageTier) {
    return null;
  }

  let selectedPlan: SfsPlan | null = null;
  let unitAmount = 0;
  const notes: string[] = [
    "Pricing uses the direct Huawei Scalable File Service package rates from the sfs calculator catalog.",
  ];

  if (durationMonths < 12) {
    const monthlyPlan = findMonthlyPlan(packageTier);
    if (!monthlyPlan) {
      return null;
    }
    selectedPlan = monthlyPlan;
    unitAmount = monthlyPlan.amount * durationMonths;
    if (durationMonths > 1) {
      notes.push("Durations from 2 to 8 months are extrapolated from the direct 1-month Huawei package rate because the catalog exposes only the 1-month monthly plan.");
    }
  } else {
    const yearlyPlan = findYearlyPlan(packageTier);
    if (!yearlyPlan) {
      return null;
    }
    selectedPlan = yearlyPlan;
    unitAmount = yearlyPlan.amount;
  }

  const amount = roundAmount(unitAmount * quantity);
  return {
    currency: catalog.currency,
    amount,
    suffix: durationMonths === 1 ? "/mo" : durationMonths === 12 ? "/1yr" : `/${durationMonths}mo`,
    monthlyAverageAmount: roundAmount(amount / durationMonths),
    quantity,
    storageSpaceGb,
    durationMonths,
    usageHours: null,
    packageTier,
    paygTier: null,
    selectedPlan,
    breakdown: [
      {
        label: `${quantity} x ${input.type} ${getStorageLabel(storageSpaceGb)} for ${durationMonths === 12 ? "1 year" : `${durationMonths} month${durationMonths === 1 ? "" : "s"}`}`,
        amount,
      },
    ],
    notes,
  };
}
