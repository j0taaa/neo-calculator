import {
  isObsCapacityUnit,
  isObsProductType,
  isObsRedundancy,
  isObsStorageClass,
  type ObsCapacityUnit,
  type ObsProductType,
  type ObsRedundancy,
  type ObsStorageClass,
} from "@/lib/obs-catalog";
import {
  isRecord,
} from "@/lib/calculator-page-helpers";
import {
  obsStorageSizeBounds,
  parsePositiveNumber,
  systemDiskOptions,
  type SystemDiskOption,
} from "@/lib/configurable-runtime-utils";

function parseNonNegativeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

export function parseBatchQuantity(value: unknown) {
  const parsed = parsePositiveNumber(value);
  if (parsed == null) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}

export function getNestedRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function isSystemDiskOption(value: unknown): value is SystemDiskOption {
  return typeof value === "string" && (systemDiskOptions as readonly string[]).includes(value);
}

export function getBatchDiskType(value: unknown, fallback: SystemDiskOption) {
  const evs = getNestedRecord(value, "evs");
  const candidates = [
    isRecord(value) ? value.type : undefined,
    isRecord(value) ? value.diskType : undefined,
    isRecord(value) ? value.systemDiskType : undefined,
    evs?.type,
    evs?.diskType,
  ];

  for (const candidate of candidates) {
    if (isSystemDiskOption(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

export function getBatchDiskSize(
  value: unknown,
  fallback: number,
  bounds: { min: number; max: number },
) {
  const evs = getNestedRecord(value, "evs");
  const candidates = [
    isRecord(value) ? value.size : undefined,
    isRecord(value) ? value.sizeGiB : undefined,
    isRecord(value) ? value.diskSizeGiB : undefined,
    isRecord(value) ? value.systemDiskSizeGiB : undefined,
    evs?.size,
    evs?.sizeGiB,
    evs?.diskSizeGiB,
  ];

  for (const candidate of candidates) {
    const parsed = parsePositiveNumber(candidate);
    if (parsed != null) {
      return Math.min(bounds.max, Math.max(bounds.min, Math.floor(parsed)));
    }
  }

  return fallback;
}

export function getBatchObsStorageClass(value: unknown, fallback: ObsStorageClass) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.storageClass : undefined,
    isRecord(value) ? value.class : undefined,
    isRecord(value) ? value.tier : undefined,
    obs?.storageClass,
    obs?.class,
    obs?.tier,
  ];

  for (const candidate of candidates) {
    if (isObsStorageClass(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

export function getBatchObsProductType(value: unknown, fallback: ObsProductType) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.productType : undefined,
    isRecord(value) ? value.type : undefined,
    obs?.productType,
    obs?.type,
  ];

  for (const candidate of candidates) {
    if (isObsProductType(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

export function getBatchObsRedundancy(value: unknown, fallback: ObsRedundancy) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.redundancy : undefined,
    isRecord(value) ? value.redundancyPolicy : undefined,
    isRecord(value) ? value.dataRedundancyPolicy : undefined,
    obs?.redundancy,
    obs?.redundancyPolicy,
    obs?.dataRedundancyPolicy,
  ];

  for (const candidate of candidates) {
    if (isObsRedundancy(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

export function getBatchObsStorageSize(value: unknown, fallback: number) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    isRecord(value) ? value.size : undefined,
    isRecord(value) ? value.sizeGiB : undefined,
    isRecord(value) ? value.storageGiB : undefined,
    isRecord(value) ? value.storageAmount : undefined,
    isRecord(value) ? value.capacityGiB : undefined,
    obs?.size,
    obs?.sizeGiB,
    obs?.storageGiB,
    obs?.storageAmount,
    obs?.capacityGiB,
  ];

  for (const candidate of candidates) {
    const parsed = parsePositiveNumber(candidate);
    if (parsed != null) {
      return Math.min(obsStorageSizeBounds.max, Math.max(obsStorageSizeBounds.min, parsed));
    }
  }

  return fallback;
}

export function getBatchObsUnit(value: unknown, fallback: ObsCapacityUnit, keys: string[]) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    ...keys.map((key) => (isRecord(value) ? value[key] : undefined)),
    ...keys.map((key) => obs?.[key]),
  ];

  for (const candidate of candidates) {
    if (isObsCapacityUnit(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

export function getBatchObsAmount(value: unknown, fallback: number, keys: string[]) {
  const obs = getNestedRecord(value, "obs");
  const candidates = [
    ...keys.map((key) => (isRecord(value) ? value[key] : undefined)),
    ...keys.map((key) => obs?.[key]),
  ];

  for (const candidate of candidates) {
    const parsed = parseNonNegativeNumber(candidate);
    if (parsed != null) {
      return Math.max(0, parsed);
    }
  }

  return fallback;
}

export function getBatchDescription(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.description === "string" && value.description.trim()) {
    return value.description.trim();
  }

  return fallback;
}

export function hasExplicitBatchDiskConfig(value: unknown) {
  const evs = getNestedRecord(value, "evs");
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type !== undefined
    || value.diskType !== undefined
    || value.systemDiskType !== undefined
    || value.size !== undefined
    || value.sizeGiB !== undefined
    || value.diskSizeGiB !== undefined
    || value.systemDiskSizeGiB !== undefined
    || evs != null
  );
}
