import type { RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type LtsStorageClass = "Standard" | "Cold";
export type LtsTransferType = "Basic" | "Advanced";

export interface LtsStorageTier {
  storageClass: LtsStorageClass;
  resourceSpecCode: string;
  ratePerGbHour: number | null;
  productId: string | null;
}

export interface LtsIndexTier {
  resourceSpecCode: string;
  ratePerGb: number | null;
  productId: string | null;
}

export interface LtsFlowTier {
  resourceSpecCode: string;
  ratePerGb: number | null;
  productId: string | null;
}

export interface LtsTransferTier {
  transferType: LtsTransferType;
  resourceSpecCode: string;
  ratePerGb: number | null;
  productId: string | null;
}

export interface LtsPricingCatalog extends RegionalPricingCatalog {
  storageTiers: LtsStorageTier[];
  indexTiers: LtsIndexTier[];
  flowTiers: LtsFlowTier[];
  transferTiers: LtsTransferTier[];
}

export interface LtsEstimateInput {
  rawLogSizeGb: number;
  intelligentColdStorage: boolean;
  logStorageDurationDays: number;
  indexFieldRatio: number;
  dailyBasicTransferVolumeGb: number;
  dailyAdvancedTransferVolumeGb: number;
  usageHours: number;
  quantity: number;
}

export interface LtsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  rawLogSizeGb: number;
  intelligentColdStorage: boolean;
  logStorageDurationDays: number;
  indexFieldRatio: number;
  dailyBasicTransferVolumeGb: number;
  dailyAdvancedTransferVolumeGb: number;
  usageHours: number;
  quantity: number;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
  standardStorageTier: LtsStorageTier;
  coldStorageTier: LtsStorageTier | null;
  indexTier: LtsIndexTier;
  flowTier: LtsFlowTier;
  basicTransferTier: LtsTransferTier | null;
  advancedTransferTier: LtsTransferTier | null;
}

export const ltsDefaults = {
  rawLogSizeGb: 10,
  intelligentColdStorage: false,
  logStorageDurationDays: 7,
  indexFieldRatio: 100,
  dailyBasicTransferVolumeGb: 0,
  dailyAdvancedTransferVolumeGb: 0,
  usageHours: 744,
  quantity: 1,
} as const;

export const ltsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/lts",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/lts.html",
} as const;

const HOT_STORAGE_DAYS_BEFORE_COLD = 7;
const MONTHLY_FREE_QUOTA_GB = 500 / 1024;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function proratedMonthlyFreeQuotaGb(usageHours: number) {
  return MONTHLY_FREE_QUOTA_GB * (usageHours / (24 * 30));
}

function getStandardStorageTier(catalog: LtsPricingCatalog) {
  return catalog.storageTiers.find((tier) => tier.storageClass === "Standard" && tier.ratePerGbHour != null) ?? null;
}

function getColdStorageTier(catalog: LtsPricingCatalog) {
  return catalog.storageTiers.find((tier) => tier.storageClass === "Cold" && tier.ratePerGbHour != null) ?? null;
}

function getIndexTier(catalog: LtsPricingCatalog) {
  return catalog.indexTiers.find((tier) => tier.ratePerGb != null) ?? null;
}

function getFlowTier(catalog: LtsPricingCatalog) {
  return catalog.flowTiers.find((tier) => tier.ratePerGb != null) ?? null;
}

function getTransferTier(catalog: LtsPricingCatalog, transferType: LtsTransferType) {
  return catalog.transferTiers.find((tier) => tier.transferType === transferType && tier.ratePerGb != null) ?? null;
}

export function estimateLtsConfiguration(catalog: LtsPricingCatalog, input: LtsEstimateInput): LtsEstimate | null {
  const standardStorageTier = getStandardStorageTier(catalog);
  const indexTier = getIndexTier(catalog);
  const flowTier = getFlowTier(catalog);
  if (!standardStorageTier || standardStorageTier.ratePerGbHour == null || !indexTier || indexTier.ratePerGb == null || !flowTier || flowTier.ratePerGb == null) {
    return null;
  }
  if (!Number.isFinite(input.rawLogSizeGb) || input.rawLogSizeGb < 0) {
    return null;
  }
  if (!Number.isFinite(input.logStorageDurationDays) || input.logStorageDurationDays < 1) {
    return null;
  }
  if (!Number.isFinite(input.indexFieldRatio) || input.indexFieldRatio < 0 || input.indexFieldRatio > 100) {
    return null;
  }
  if (!Number.isFinite(input.dailyBasicTransferVolumeGb) || input.dailyBasicTransferVolumeGb < 0) {
    return null;
  }
  if (!Number.isFinite(input.dailyAdvancedTransferVolumeGb) || input.dailyAdvancedTransferVolumeGb < 0) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }

  const coldStorageTier = input.intelligentColdStorage ? getColdStorageTier(catalog) : null;
  if (input.intelligentColdStorage && !coldStorageTier?.ratePerGbHour) {
    return null;
  }
  const basicTransferTier = input.dailyBasicTransferVolumeGb > 0 ? getTransferTier(catalog, "Basic") : null;
  const advancedTransferTier = input.dailyAdvancedTransferVolumeGb > 0 ? getTransferTier(catalog, "Advanced") : null;
  if (input.dailyBasicTransferVolumeGb > 0 && !basicTransferTier?.ratePerGb) {
    return null;
  }
  if (input.dailyAdvancedTransferVolumeGb > 0 && !advancedTransferTier?.ratePerGb) {
    return null;
  }

  const rawLogSizeGb = roundAmount(input.rawLogSizeGb);
  const logStorageDurationDays = Math.floor(input.logStorageDurationDays);
  const indexFieldRatio = roundAmount(input.indexFieldRatio);
  const dailyBasicTransferVolumeGb = roundAmount(input.dailyBasicTransferVolumeGb);
  const dailyAdvancedTransferVolumeGb = roundAmount(input.dailyAdvancedTransferVolumeGb);
  const usageHours = Math.floor(input.usageHours);
  const quantity = Math.floor(input.quantity);
  const usageDays = usageHours / 24;
  const freeQuotaGb = proratedMonthlyFreeQuotaGb(usageHours);

  const standardStorageDays = input.intelligentColdStorage
    ? Math.min(logStorageDurationDays, HOT_STORAGE_DAYS_BEFORE_COLD)
    : logStorageDurationDays;
  const coldStorageDays = input.intelligentColdStorage
    ? Math.max(logStorageDurationDays - HOT_STORAGE_DAYS_BEFORE_COLD, 0)
    : 0;

  const compressedReadWriteGb = rawLogSizeGb * usageDays / 5;
  const billableReadWriteGb = Math.max(0, compressedReadWriteGb - freeQuotaGb);
  const indexTrafficGb = rawLogSizeGb * (indexFieldRatio / 100) * usageDays;
  const billableIndexTrafficGb = Math.max(0, indexTrafficGb - freeQuotaGb);
  const standardStorageVolumeGb = rawLogSizeGb * standardStorageDays;
  const billableStandardStorageVolumeGb = Math.max(0, standardStorageVolumeGb - freeQuotaGb);
  const coldStorageVolumeGb = rawLogSizeGb * coldStorageDays;

  const readWriteAmount = roundAmount(billableReadWriteGb * flowTier.ratePerGb * quantity);
  const indexAmount = roundAmount(billableIndexTrafficGb * indexTier.ratePerGb * quantity);
  const standardStorageAmount = roundAmount(billableStandardStorageVolumeGb * standardStorageTier.ratePerGbHour * usageHours * quantity);
  const coldStorageAmount = roundAmount((coldStorageTier?.ratePerGbHour ?? 0) * coldStorageVolumeGb * usageHours * quantity);
  const basicTransferAmount = roundAmount((basicTransferTier?.ratePerGb ?? 0) * dailyBasicTransferVolumeGb * usageDays * quantity);
  const advancedTransferAmount = roundAmount((advancedTransferTier?.ratePerGb ?? 0) * dailyAdvancedTransferVolumeGb * usageDays * quantity);
  const amount = roundAmount(
    readWriteAmount
    + indexAmount
    + standardStorageAmount
    + coldStorageAmount
    + basicTransferAmount
    + advancedTransferAmount,
  );
  const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${usageHours}h`,
    monthlyAverageAmount,
    rawLogSizeGb,
    intelligentColdStorage: input.intelligentColdStorage,
    logStorageDurationDays,
    indexFieldRatio,
    dailyBasicTransferVolumeGb,
    dailyAdvancedTransferVolumeGb,
    usageHours,
    quantity,
    breakdown: [
      {
        label: `${quantity} x read/write traffic`,
        amount: readWriteAmount,
      },
      {
        label: `${quantity} x index traffic`,
        amount: indexAmount,
      },
      {
        label: `${quantity} x standard storage`,
        amount: standardStorageAmount,
      },
      ...(coldStorageAmount > 0
        ? [{
            label: `${quantity} x cold storage`,
            amount: coldStorageAmount,
          }]
        : []),
      ...(basicTransferAmount > 0
        ? [{
            label: `${quantity} x basic transfer`,
            amount: basicTransferAmount,
          }]
        : []),
      ...(advancedTransferAmount > 0
        ? [{
            label: `${quantity} x advanced transfer`,
            amount: advancedTransferAmount,
          }]
        : []),
    ],
    notes: [
      "Read/write traffic uses the documented 20% compression rule from Huawei LTS billing.",
      `A prorated ${MONTHLY_FREE_QUOTA_GB.toFixed(6)} GB monthly free quota is applied to read/write traffic, standard index traffic, and standard storage.`,
      input.intelligentColdStorage
        ? `Intelligent cold storage keeps logs in standard storage for ${HOT_STORAGE_DAYS_BEFORE_COLD} days before transitioning the remaining retention period to cold storage.`
        : "Intelligent cold storage is disabled, so the full retention period remains in standard storage.",
      `Read/write rate: ${catalog.currency} ${flowTier.ratePerGb.toFixed(6)}/GB.`,
      `Index rate: ${catalog.currency} ${indexTier.ratePerGb.toFixed(6)}/GB.`,
      `Standard storage rate: ${catalog.currency} ${standardStorageTier.ratePerGbHour.toFixed(6)}/GB/h.`,
      coldStorageTier?.ratePerGbHour != null
        ? `Cold storage rate: ${catalog.currency} ${coldStorageTier.ratePerGbHour.toFixed(6)}/GB/h.`
        : "Cold storage is not part of this estimate.",
    ],
    standardStorageTier,
    coldStorageTier,
    indexTier,
    flowTier,
    basicTransferTier,
    advancedTransferTier,
  };
}
