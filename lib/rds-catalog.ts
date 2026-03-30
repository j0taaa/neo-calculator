import type { RegionalPricingCatalog, ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type RdsEngine = "MySQL" | "PostgreSQL";
export type RdsVersion = "8.0" | "5.7" | "17" | "16" | "15" | "14" | "13";
export type RdsInstanceType = "Primary/Standby" | "Single" | "Read replica";
export type RdsInstanceClass = "General-purpose" | "Dedicated";
export type RdsStorageType = "Flexible SSD" | "Cloud SSD" | "Extreme SSD";

export interface RdsComputeTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  engine: RdsEngine;
  version: RdsVersion;
  instanceType: RdsInstanceType;
  instanceClass: RdsInstanceClass;
  cpu: number;
  memoryGiB: number;
  sizeLabel: string;
}

export interface RdsStorageTier extends ResourcePricingTierWithProducts<"ONDEMAND" | "MONTHLY" | "YEARLY"> {
  engine: RdsEngine;
  instanceType: RdsInstanceType;
  storageType: RdsStorageType;
  iopsRatePerUnit?: number | null;
  throughputRatePerUnit?: number | null;
}

export interface RdsPricingCatalog extends RegionalPricingCatalog {
  computeTiers: RdsComputeTier[];
  storageTiers: RdsStorageTier[];
}

export interface RdsEstimateInput {
  engine: RdsEngine;
  version: RdsVersion;
  instanceType: RdsInstanceType;
  instanceClass: RdsInstanceClass;
  size: string;
  storageType: RdsStorageType;
  storageSizeGb: number;
  iops: number;
  throughputMibps: number;
  usageHours: number;
  quantity: number;
}

export interface RdsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface RdsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  computeTier: RdsComputeTier;
  storageTier: RdsStorageTier;
  computeAmount: number;
  storageAmount: number;
  memorySurchargeAmount: number;
  iopsAmount: number;
  throughputAmount: number;
  breakdown: RdsEstimateBreakdownItem[];
  notes: string[];
}

export const rdsDefaults = {
  engine: "MySQL" as RdsEngine,
  version: "8.0" as RdsVersion,
  instanceType: "Primary/Standby" as RdsInstanceType,
  subAz: "General AZ",
  instanceClass: "General-purpose" as RdsInstanceClass,
  size: "2 vCPUs, 4 GB",
  storageType: "Flexible SSD" as RdsStorageType,
  storageSizeGb: 40,
  iops: 3000,
  throughputMibps: 128,
  usageHours: 744,
  quantity: 1,
} as const;

export const rdsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/rds",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/rds.html",
} as const;

const engineOrder: RdsEngine[] = ["MySQL", "PostgreSQL"];
const mysqlVersionOrder: Extract<RdsVersion, "8.0" | "5.7">[] = ["8.0", "5.7"];
const postgresqlVersionOrder: Extract<RdsVersion, "17" | "16" | "15" | "14" | "13">[] = ["17", "16", "15", "14", "13"];
const instanceTypeOrder: RdsInstanceType[] = ["Primary/Standby", "Single", "Read replica"];
const classOrder: RdsInstanceClass[] = ["General-purpose", "Dedicated"];
const storageTypeOrder: RdsStorageType[] = ["Flexible SSD", "Cloud SSD", "Extreme SSD"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function isRdsEngine(value: unknown): value is RdsEngine {
  return typeof value === "string" && engineOrder.includes(value as RdsEngine);
}

export function isRdsVersion(value: unknown): value is RdsVersion {
  return typeof value === "string" && [...mysqlVersionOrder, ...postgresqlVersionOrder].includes(value as RdsVersion);
}

export function isRdsInstanceType(value: unknown): value is RdsInstanceType {
  return typeof value === "string" && instanceTypeOrder.includes(value as RdsInstanceType);
}

export function isRdsInstanceClass(value: unknown): value is RdsInstanceClass {
  return typeof value === "string" && classOrder.includes(value as RdsInstanceClass);
}

export function isRdsStorageType(value: unknown): value is RdsStorageType {
  return typeof value === "string" && storageTypeOrder.includes(value as RdsStorageType);
}

export function listRdsEngines(catalog: RdsPricingCatalog) {
  const values = new Set<RdsEngine>();
  for (const tier of catalog.computeTiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.engine);
    }
  }
  return engineOrder.filter((value) => values.has(value));
}

export function listRdsVersions(catalog: RdsPricingCatalog, engine: RdsEngine) {
  const values = new Set<RdsVersion>();
  for (const tier of catalog.computeTiers) {
    if (tier.engine === engine && tier.prices.ONDEMAND != null) {
      values.add(tier.version);
    }
  }
  const order = engine === "MySQL" ? mysqlVersionOrder : postgresqlVersionOrder;
  return order.filter((value) => values.has(value));
}

export function listRdsInstanceTypes(catalog: RdsPricingCatalog, options: { engine: RdsEngine; version: RdsVersion }) {
  const values = new Set<RdsInstanceType>();
  for (const tier of catalog.computeTiers) {
    if (tier.engine === options.engine && tier.version === options.version && tier.prices.ONDEMAND != null) {
      values.add(tier.instanceType);
    }
  }
  return instanceTypeOrder.filter((value) => values.has(value));
}

export function listRdsInstanceClasses(catalog: RdsPricingCatalog, options: { engine: RdsEngine; version: RdsVersion; instanceType: RdsInstanceType }) {
  const values = new Set<RdsInstanceClass>();
  for (const tier of catalog.computeTiers) {
    if (
      tier.engine === options.engine
      && tier.version === options.version
      && tier.instanceType === options.instanceType
      && tier.prices.ONDEMAND != null
    ) {
      values.add(tier.instanceClass);
    }
  }
  return classOrder.filter((value) => values.has(value));
}

export function listRdsSizes(
  catalog: RdsPricingCatalog,
  options: {
    engine: RdsEngine;
    version: RdsVersion;
    instanceType: RdsInstanceType;
    instanceClass: RdsInstanceClass;
  },
) {
  return catalog.computeTiers
    .filter((tier) => (
      tier.engine === options.engine
      && tier.version === options.version
      && tier.instanceType === options.instanceType
      && tier.instanceClass === options.instanceClass
      && tier.prices.ONDEMAND != null
    ))
    .sort((left, right) => {
      if (left.cpu !== right.cpu) {
        return left.cpu - right.cpu;
      }
      return left.memoryGiB - right.memoryGiB;
    })
    .map((tier) => tier.sizeLabel);
}

export function listRdsStorageTypes(
  catalog: RdsPricingCatalog,
  options: {
    engine: RdsEngine;
    instanceType: RdsInstanceType;
  },
) {
  const values = new Set<RdsStorageType>();
  for (const tier of catalog.storageTiers) {
    if (tier.engine === options.engine && tier.instanceType === options.instanceType && tier.prices.ONDEMAND != null) {
      values.add(tier.storageType);
    }
  }
  return storageTypeOrder.filter((value) => values.has(value));
}

export function findRdsComputeTier(
  catalog: RdsPricingCatalog,
  options: {
    engine: RdsEngine;
    version: RdsVersion;
    instanceType: RdsInstanceType;
    instanceClass: RdsInstanceClass;
    size: string;
  },
) {
  return catalog.computeTiers.find((tier) => (
    tier.engine === options.engine
    && tier.version === options.version
    && tier.instanceType === options.instanceType
    && tier.instanceClass === options.instanceClass
    && tier.sizeLabel === options.size
  )) ?? null;
}

export function findRdsStorageTier(
  catalog: RdsPricingCatalog,
  options: {
    engine: RdsEngine;
    instanceType: RdsInstanceType;
    storageType: RdsStorageType;
  },
) {
  return catalog.storageTiers.find((tier) => (
    tier.engine === options.engine
    && tier.instanceType === options.instanceType
    && tier.storageType === options.storageType
  )) ?? null;
}

export function estimateRdsConfiguration(catalog: RdsPricingCatalog, input: RdsEstimateInput): RdsEstimate | null {
  const computeTier = findRdsComputeTier(catalog, input);
  const storageTier = findRdsStorageTier(catalog, input);
  if (!computeTier || !storageTier || computeTier.prices.ONDEMAND == null || storageTier.prices.ONDEMAND == null) {
    return null;
  }

  const usageHours = Number.isFinite(input.usageHours) ? Math.max(1, Math.floor(input.usageHours)) : 1;
  const quantity = Number.isFinite(input.quantity) ? Math.max(1, Math.floor(input.quantity)) : 1;
  const storageSizeGb = Number.isFinite(input.storageSizeGb) ? Math.max(40, Math.floor(input.storageSizeGb)) : 40;
  const computeAmount = computeTier.prices.ONDEMAND * usageHours;
  const storageAmount = storageTier.prices.ONDEMAND * storageSizeGb * usageHours;
  const memorySurchargeAmount = 0;
  const iopsAmount = 0;
  const throughputAmount = 0;

  const unitAmount = roundAmount(computeAmount + storageAmount + memorySurchargeAmount + iopsAmount + throughputAmount);
  const amount = roundAmount(unitAmount * quantity);
  const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));
  const breakdown = [
    { label: `${quantity} x DB instance`, amount: roundAmount(computeAmount * quantity) },
    { label: `${quantity} x ${input.storageType} ${storageSizeGb} GB`, amount: roundAmount(storageAmount * quantity) },
  ];
  if (memorySurchargeAmount > 0) {
    breakdown.push({
      label: `${quantity} x MySQL memory surcharge`,
      amount: roundAmount(memorySurchargeAmount * quantity),
    });
  }
  if (input.storageType === "Flexible SSD" && throughputAmount > 0) {
    breakdown.push({
      label: `${quantity} x Flexible SSD throughput ${input.throughputMibps} MiB/s`,
      amount: roundAmount(throughputAmount * quantity),
    });
  }
  if (input.storageType === "Flexible SSD" && iopsAmount > 0) {
    breakdown.push({
      label: `${quantity} x Flexible SSD additional IOPS ${Math.max(0, input.iops - 3000)}`,
      amount: roundAmount(iopsAmount * quantity),
    });
  }

  const notes = [
    input.instanceType === "Read replica"
      ? "Read replica pricing models only the replica instance. You must create the primary DB instance separately."
      : "Primary/Standby uses the direct Huawei HA spec rate returned by the catalog for the selected configuration.",
    input.storageType === "Flexible SSD"
      ? "Flexible SSD uses the direct Huawei storage rate returned by the catalog. Additional IOPS and throughput rows are not applied because the API does not expose a reliable billable baseline for the current input."
      : `Storage uses the direct Huawei ${input.storageType} rate returned by the catalog.`,
  ];

  return {
    currency: catalog.currency,
    amount,
    suffix: "/mo",
    monthlyAverageAmount,
    quantity,
    computeTier,
    storageTier,
    computeAmount: roundAmount(computeAmount * quantity),
    storageAmount: roundAmount(storageAmount * quantity),
    memorySurchargeAmount: roundAmount(memorySurchargeAmount * quantity),
    iopsAmount: roundAmount(iopsAmount * quantity),
    throughputAmount: roundAmount(throughputAmount * quantity),
    breakdown,
    notes,
  };
}
