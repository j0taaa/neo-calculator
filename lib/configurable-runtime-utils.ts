import {
  convertObsRequestCountToInput,
  getObsRedundancyOptions,
  getObsStorageClassOptions,
  isObsCapacityUnit,
  isObsProductType,
  isObsRedundancy,
  isObsRestorationType,
  isObsStorageClass,
  shouldShowObsRedundancySelector,
  type ObsProductType,
  type ObsRedundancy,
  type ObsRestorationType,
  type ObsStorageClass,
} from "@/lib/obs-catalog";
import { formatFlavorAmount, getDiskPriceForBillingOption, type BillingOption, type DiskPricing, type ProductMutationBody } from "@/lib/calculator-page-helpers";
import { type HuaweiRegionKey } from "@/lib/huawei-regions";

export const evsSingleDiskMaxGiB = 32_768;
export const gpSsd2IopsBounds = { min: 3_000, max: 128_000 } as const;
export const gpSsd2ThroughputBounds = { min: 125, max: 1_000 } as const;
export const ecsDiskSizeBounds = { min: 40, max: 1024 } as const;
export const evsDiskSizeBounds = { min: 1, max: 1_000_000 } as const;
export const obsStorageSizeBounds = { min: 1, max: 1_000_000_000 } as const;
export const systemDiskOptions = [
  "High I/O",
  "Ultra-high I/O",
  "Extreme SSD",
  "General Purpose SSD",
  "General Purpose SSD V2",
] as const;

export type SystemDiskOption = (typeof systemDiskOptions)[number];

export type ObsRequestUnits = number;

export function parsePositiveNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function getGpSsd2IopsBounds(sizeGiB: number) {
  const max = Math.max(1, Math.min(gpSsd2IopsBounds.max, Math.floor(sizeGiB * 500)));
  return {
    min: Math.min(gpSsd2IopsBounds.min, max),
    max,
  };
}

export function normalizeGpSsd2Iops(value: unknown, sizeGiB: number) {
  const bounds = getGpSsd2IopsBounds(sizeGiB);
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
}

export function getGpSsd2ThroughputBounds(iops: number) {
  const max = Math.max(1, Math.min(gpSsd2ThroughputBounds.max, Math.floor(iops / 4)));
  return {
    min: Math.min(gpSsd2ThroughputBounds.min, max),
    max,
  };
}

export function normalizeGpSsd2Throughput(value: unknown, iops: number) {
  const bounds = getGpSsd2ThroughputBounds(iops);
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
}

function getNestedRecord(value: unknown, key: string) {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return null;
  }

  const nested = (value as Record<string, unknown>)[key];
  return typeof nested === "object" && nested != null && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getGpSsd2RequestedIops(value: unknown, fallbackSizeGiB: number) {
  const evs = getNestedRecord(value, "evs");
  const systemDisk = getNestedRecord(value, "systemDisk");
  const candidates = [
    isRecord(value) ? value.iops : undefined,
    isRecord(value) ? value.diskIops : undefined,
    evs?.iops,
    evs?.diskIops,
    systemDisk?.iops,
    systemDisk?.diskIops,
  ];

  for (const candidate of candidates) {
    if (parsePositiveNumber(candidate) != null) {
      return normalizeGpSsd2Iops(candidate, fallbackSizeGiB);
    }
  }

  return normalizeGpSsd2Iops(undefined, fallbackSizeGiB);
}

export function getGpSsd2RequestedThroughput(value: unknown, fallbackIops: number) {
  const evs = getNestedRecord(value, "evs");
  const systemDisk = getNestedRecord(value, "systemDisk");
  const candidates = [
    isRecord(value) ? value.throughput : undefined,
    isRecord(value) ? value.diskThroughput : undefined,
    evs?.throughput,
    evs?.diskThroughput,
    systemDisk?.throughput,
    systemDisk?.diskThroughput,
  ];

  for (const candidate of candidates) {
    if (parsePositiveNumber(candidate) != null) {
      return normalizeGpSsd2Throughput(candidate, fallbackIops);
    }
  }

  return normalizeGpSsd2Throughput(undefined, fallbackIops);
}

export function splitEvsDiskSizes(totalGiB: number) {
  const normalizedTotal = Math.max(1, Math.floor(totalGiB));
  const chunks: number[] = [];
  let remaining = normalizedTotal;

  while (remaining > evsSingleDiskMaxGiB) {
    chunks.push(evsSingleDiskMaxGiB);
    remaining -= evsSingleDiskMaxGiB;
  }

  chunks.push(remaining);
  return chunks;
}

export function buildEvsProductMutationBodies<SystemDiskOption extends string>(input: {
  serviceCode: string;
  serviceName: string;
  serviceTitle: string;
  region: HuaweiRegionKey;
  billingMode: BillingOption;
  usageHours: number;
  durationMonths: number;
  quantity: number;
  description: string;
  diskType: SystemDiskOption;
  diskSizeGiB: number;
  requestedIops: number | null;
  requestedThroughput: number | null;
  diskPricing: DiskPricing<SystemDiskOption> | null;
}) {
  const chunkSizes = splitEvsDiskSizes(input.diskSizeGiB);

  return chunkSizes.map((chunkSizeGiB) => {
    const price = getDiskPriceForBillingOption(
      input.diskPricing,
      input.diskType,
      chunkSizeGiB,
      input.billingMode,
      input.usageHours,
      input.durationMonths,
    );
    const chunkIops = input.diskType === "General Purpose SSD V2" && input.requestedIops != null
      ? normalizeGpSsd2Iops(input.requestedIops, chunkSizeGiB)
      : null;
    const chunkThroughput =
      input.diskType === "General Purpose SSD V2" && input.requestedThroughput != null && chunkIops != null
        ? normalizeGpSsd2Throughput(input.requestedThroughput, chunkIops)
        : null;

    if (!price) {
      throw new Error("Unable to price one of the EVS split disks.");
    }

    return {
      serviceCode: input.serviceCode,
      serviceName: input.serviceName,
      productType: "evs",
      title: `${input.serviceTitle} ${input.diskType} ${chunkSizeGiB} GiB`,
      quantity: input.quantity,
      config: {
        region: input.region,
        billingMode: input.billingMode,
        usageHours: input.billingMode === "Pay-per-use" ? input.usageHours : null,
        durationMonths: input.billingMode === "Yearly/Monthly" ? input.durationMonths : null,
        description: input.description,
        diskType: input.diskType,
        diskSizeGiB: chunkSizeGiB,
        ...(chunkIops != null ? { iops: chunkIops } : {}),
        ...(chunkThroughput != null ? { throughput: chunkThroughput } : {}),
        requestedDiskSizeGiB: input.diskSizeGiB,
        splitDiskCount: chunkSizes.length,
      },
      pricing: {
        total: formatFlavorAmount(price.currency, price.amount * input.quantity, price.suffix),
        disk: formatFlavorAmount(price.currency, price.amount, price.suffix),
      },
    } satisfies ProductMutationBody;
  });
}

export function buildEvsSplitNotice(totalGiB: number) {
  if (totalGiB <= evsSingleDiskMaxGiB) {
    return null;
  }

  const chunks = splitEvsDiskSizes(totalGiB);
  return `Totals above ${evsSingleDiskMaxGiB} GiB are saved as multiple disks: ${chunks.join(" GiB + ")} GiB.`;
}

export function getObsRequestUnits(step: number | null | undefined, value: number): ObsRequestUnits {
  return typeof step === "number" && Number.isFinite(step) && step > 0 ? value / step : value;
}

export function formatObsRequestInputValue(value: number) {
  const normalized = convertObsRequestCountToInput(value);
  return Number.isInteger(normalized) ? String(normalized) : String(Number(normalized.toFixed(4)));
}

export function normalizeObsDefinitionDefaults(defaults: Record<string, unknown>) {
  const productType = isObsProductType(defaults.productType) ? defaults.productType : "Object storage";
  const storageClass = isObsStorageClass(defaults.storageClass) ? defaults.storageClass : "Standard";
  const redundancy = isObsRedundancy(defaults.redundancy) ? defaults.redundancy : "Single-AZ storage";

  return {
    productType,
    storageClass,
    redundancy: shouldShowObsRedundancySelector(productType, storageClass)
      ? redundancy
      : getObsRedundancyOptions(productType, storageClass)[0] ?? "Single-AZ storage",
    storageUnit: isObsCapacityUnit(defaults.storageUnit) ? defaults.storageUnit : "GB",
    outboundTrafficUnit: isObsCapacityUnit(defaults.outboundTrafficUnit) ? defaults.outboundTrafficUnit : "GB",
    pullTrafficUnit: isObsCapacityUnit(defaults.pullTrafficUnit) ? defaults.pullTrafficUnit : "GB",
    readTrafficUnit: isObsCapacityUnit(defaults.readTrafficUnit) ? defaults.readTrafficUnit : "GB",
    replicationTrafficUnit: isObsCapacityUnit(defaults.replicationTrafficUnit) ? defaults.replicationTrafficUnit : "GB",
    restorationType: isObsRestorationType(defaults.restorationType) ? defaults.restorationType : null,
  };
}

export function normalizeObsFieldDependencies(input: {
  productType: ObsProductType;
  storageClass: ObsStorageClass;
  redundancy: ObsRedundancy;
  restorationType: ObsRestorationType | null;
}) {
  const storageClassOptions = getObsStorageClassOptions(input.productType);
  const storageClass = storageClassOptions.includes(input.storageClass) ? input.storageClass : storageClassOptions[0] ?? "Standard";
  const redundancyOptions = getObsRedundancyOptions(input.productType, storageClass);
  const redundancy = redundancyOptions.includes(input.redundancy) ? input.redundancy : redundancyOptions[0] ?? "Single-AZ storage";
  const restorationOptions =
    storageClass === "Infrequent Access"
      ? (["Urgent: 1-5 minutes"] as ObsRestorationType[])
      : storageClass === "Archive"
      ? (["Urgent: 1-5 minutes", "Standard: 3-5 hours", "Direct Reading"] as ObsRestorationType[])
      : storageClass === "Deep Archive"
      ? (["Urgent: 3-5 hours", "Standard: 5-12 hours"] as ObsRestorationType[])
      : [];

  return {
    storageClass,
    redundancy,
    restorationType: restorationOptions.includes(input.restorationType as ObsRestorationType)
      ? input.restorationType
      : restorationOptions[0] ?? null,
  };
}
