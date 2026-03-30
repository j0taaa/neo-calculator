import type { RegionalPricingCatalog, ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type FlexusRdsEngine = "MySQL" | "PostgreSQL";
export type FlexusRdsVersion = "8.0" | "5.7" | "12" | "11" | "10" | "9.6" | "9.5";
export type FlexusRdsInstanceType = "Primary/Standby" | "Single";
export type FlexusRdsInstanceClass = "Lightweight";
export type FlexusRdsStorageType = "Cloud SSD";

export interface FlexusRdsComputeTier extends ResourcePricingTierWithProducts<"MONTHLY" | "YEARLY"> {
  engine: FlexusRdsEngine;
  instanceType: FlexusRdsInstanceType;
  instanceClass: FlexusRdsInstanceClass;
  cpu: number;
  memoryGiB: number;
  sizeLabel: string;
}

export interface FlexusRdsStorageTier extends ResourcePricingTierWithProducts<"MONTHLY" | "YEARLY"> {
  engine: FlexusRdsEngine;
  instanceType: FlexusRdsInstanceType;
  storageType: FlexusRdsStorageType;
}

export interface FlexusRdsPricingCatalog extends RegionalPricingCatalog {
  computeTiers: FlexusRdsComputeTier[];
  storageTiers: FlexusRdsStorageTier[];
}

export interface FlexusRdsEstimateInput {
  engine: FlexusRdsEngine;
  version: FlexusRdsVersion;
  instanceType: FlexusRdsInstanceType;
  instanceClass: FlexusRdsInstanceClass;
  size: string;
  storageType: FlexusRdsStorageType;
  storageSizeGb: number;
  durationMonths: number;
  quantity: number;
}

export interface FlexusRdsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface FlexusRdsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  durationMonths: number;
  computeTier: FlexusRdsComputeTier;
  storageTier: FlexusRdsStorageTier;
  computeAmount: number;
  storageAmount: number;
  breakdown: FlexusRdsEstimateBreakdownItem[];
  notes: string[];
}

export const flexusRdsDefaults = {
  engine: "MySQL" as FlexusRdsEngine,
  version: "8.0" as FlexusRdsVersion,
  instanceType: "Primary/Standby" as FlexusRdsInstanceType,
  instanceClass: "Lightweight" as FlexusRdsInstanceClass,
  size: "2 vCPUs, 4 GB",
  storageType: "Cloud SSD" as FlexusRdsStorageType,
  storageSizeGb: 120,
  durationMonths: 1,
  quantity: 1,
} as const;

export const flexusRdsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/hrds",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
} as const;

const engineOrder: FlexusRdsEngine[] = ["MySQL", "PostgreSQL"];
const mysqlVersionOrder: Extract<FlexusRdsVersion, "8.0" | "5.7">[] = ["8.0", "5.7"];
const postgresqlVersionOrder: Extract<FlexusRdsVersion, "12" | "11" | "10" | "9.6" | "9.5">[] = ["12", "11", "10", "9.6", "9.5"];
const instanceTypeOrder: FlexusRdsInstanceType[] = ["Primary/Standby", "Single"];
const durationMonthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12] as const;

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function isFlexusRdsEngine(value: unknown): value is FlexusRdsEngine {
  return typeof value === "string" && engineOrder.includes(value as FlexusRdsEngine);
}

export function isFlexusRdsVersion(value: unknown): value is FlexusRdsVersion {
  return typeof value === "string" && [...mysqlVersionOrder, ...postgresqlVersionOrder].includes(value as FlexusRdsVersion);
}

export function isFlexusRdsInstanceType(value: unknown): value is FlexusRdsInstanceType {
  return typeof value === "string" && instanceTypeOrder.includes(value as FlexusRdsInstanceType);
}

export function listFlexusRdsEngines(catalog: FlexusRdsPricingCatalog) {
  const values = new Set<FlexusRdsEngine>();
  for (const tier of catalog.computeTiers) {
    if (tier.prices.MONTHLY != null || tier.prices.YEARLY != null) {
      values.add(tier.engine);
    }
  }
  return engineOrder.filter((value) => values.has(value));
}

export function listFlexusRdsVersions(engine: FlexusRdsEngine) {
  return engine === "MySQL" ? [...mysqlVersionOrder] : [...postgresqlVersionOrder];
}

export function listFlexusRdsInstanceTypes(catalog: FlexusRdsPricingCatalog, engine: FlexusRdsEngine) {
  const values = new Set<FlexusRdsInstanceType>();
  for (const tier of catalog.computeTiers) {
    if (tier.engine === engine && (tier.prices.MONTHLY != null || tier.prices.YEARLY != null)) {
      values.add(tier.instanceType);
    }
  }
  return instanceTypeOrder.filter((value) => values.has(value));
}

export function listFlexusRdsSizes(
  catalog: FlexusRdsPricingCatalog,
  options: {
    engine: FlexusRdsEngine;
    instanceType: FlexusRdsInstanceType;
  },
) {
  return catalog.computeTiers
    .filter((tier) => (
      tier.engine === options.engine
      && tier.instanceType === options.instanceType
      && (tier.prices.MONTHLY != null || tier.prices.YEARLY != null)
    ))
    .sort((left, right) => {
      if (left.cpu !== right.cpu) {
        return left.cpu - right.cpu;
      }
      return left.memoryGiB - right.memoryGiB;
    })
    .map((tier) => tier.sizeLabel);
}

export function findFlexusRdsComputeTier(
  catalog: FlexusRdsPricingCatalog,
  options: {
    engine: FlexusRdsEngine;
    instanceType: FlexusRdsInstanceType;
    size: string;
  },
) {
  return catalog.computeTiers.find((tier) => (
    tier.engine === options.engine
    && tier.instanceType === options.instanceType
    && tier.sizeLabel === options.size
  )) ?? null;
}

export function findFlexusRdsStorageTier(
  catalog: FlexusRdsPricingCatalog,
  options: {
    engine: FlexusRdsEngine;
    instanceType: FlexusRdsInstanceType;
  },
) {
  return catalog.storageTiers.find((tier) => (
    tier.engine === options.engine
    && tier.instanceType === options.instanceType
    && tier.storageType === "Cloud SSD"
  )) ?? null;
}

function normalizeDurationMonths(value: number) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : 1;
  return durationMonthOptions.includes(parsed as typeof durationMonthOptions[number]) ? parsed : 1;
}

function getDurationLabel(durationMonths: number) {
  return durationMonths === 12 ? "1 year" : `${durationMonths} month${durationMonths === 1 ? "" : "s"}`;
}

export function estimateFlexusRdsConfiguration(catalog: FlexusRdsPricingCatalog, input: FlexusRdsEstimateInput): FlexusRdsEstimate | null {
  const computeTier = findFlexusRdsComputeTier(catalog, input);
  const storageTier = findFlexusRdsStorageTier(catalog, input);
  if (!computeTier || !storageTier) {
    return null;
  }

  const durationMonths = normalizeDurationMonths(input.durationMonths);
  const quantity = Number.isFinite(input.quantity) ? Math.max(1, Math.floor(input.quantity)) : 1;
  const storageSizeGb = Number.isFinite(input.storageSizeGb) ? Math.max(40, Math.floor(input.storageSizeGb)) : 40;
  const billingMode = durationMonths === 12 ? "YEARLY" : "MONTHLY";
  const computeRate = computeTier.prices[billingMode];
  const storageRate = storageTier.prices[billingMode];
  if (computeRate == null || storageRate == null) {
    return null;
  }

  const computeUnitAmount = durationMonths === 12 ? computeRate : computeRate * durationMonths;
  const storageUnitAmount = (durationMonths === 12 ? storageRate : storageRate * durationMonths) * storageSizeGb;
  const unitAmount = roundAmount(computeUnitAmount + storageUnitAmount);
  const amount = roundAmount(unitAmount * quantity);
  const monthlyAverageAmount = roundAmount(amount / (durationMonths === 12 ? 12 : durationMonths));
  const durationLabel = getDurationLabel(durationMonths);
  const suffix = durationMonths === 12 ? "/1yr" : durationMonths === 1 ? "/mo" : `/${durationMonths}mo`;

  return {
    currency: catalog.currency,
    amount,
    suffix,
    monthlyAverageAmount,
    quantity,
    durationMonths,
    computeTier,
    storageTier,
    computeAmount: roundAmount(computeUnitAmount * quantity),
    storageAmount: roundAmount(storageUnitAmount * quantity),
    breakdown: [
      {
        label: `${quantity} x DB instance for ${durationLabel}`,
        amount: roundAmount(computeUnitAmount * quantity),
      },
      {
        label: `${quantity} x Cloud SSD ${storageSizeGb} GB for ${durationLabel}`,
        amount: roundAmount(storageUnitAmount * quantity),
      },
    ],
    notes: [
      "Lightweight maps to the Huawei HRDS class returned by the hrds calculator catalog.",
      `Pricing uses the direct Huawei ${billingMode === "YEARLY" ? "1-year" : "monthly"} rates returned by the hrds catalog.`,
    ],
  };
}
