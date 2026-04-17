import { orderedSet, type PricingRateSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DcsVersion = "7.0" | "6.0" | "5.0" | "4.0";
export type DcsInstanceType = "Single-node" | "Master/Standby" | "Redis Cluster";
export type DcsArchitecture = "x86 | DRAM" | "ARM | DRAM";
export type DcsBandwidthMode = "Buy now" | "Buy later";

export type DcsRateSet = PricingRateSet<"ONDEMAND">;

export interface DcsInstanceTier extends ResourcePricingTierWithProducts<"ONDEMAND"> {
  edition: "Basic";
  version: DcsVersion;
  instanceType: DcsInstanceType;
  architecture: DcsArchitecture;
  replicas: number | null;
  specification: string;
  memoryGiB: number;
}

export interface DcsPricingCatalog extends RegionalPricingCatalog {
  edition: "Basic";
  instanceTiers: DcsInstanceTier[];
  bandwidthRatePerMbitHour: number | null;
}

export interface DcsEstimateInput {
  edition: "Basic";
  version: DcsVersion;
  instanceType: DcsInstanceType;
  architecture: DcsArchitecture;
  replicas: number | null;
  specification: string;
  quantity: number;
  elasticBandwidth: DcsBandwidthMode;
  bandwidthMbit: number;
  usageHours: number;
}

export interface DcsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DcsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  quantity: number;
  usageHours: number;
  tier: DcsInstanceTier;
  bandwidthRatePerMbitHour: number | null;
  breakdown: DcsEstimateBreakdownItem[];
  notes: string[];
}

export const dcsDefaults = {
  edition: "Basic" as const,
  version: "7.0" as DcsVersion,
  instanceType: "Single-node" as DcsInstanceType,
  architecture: "x86 | DRAM" as DcsArchitecture,
  replicas: 2,
  specification: "4 GB",
  quantity: 1,
  elasticBandwidth: "Buy later" as DcsBandwidthMode,
  bandwidthMbit: 1,
  usageHours: 744,
} as const;

export const dcsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/redis",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/dcs.html",
} as const;

const versionOrder: DcsVersion[] = ["7.0", "6.0", "5.0", "4.0"];
const instanceTypeOrder: DcsInstanceType[] = ["Single-node", "Master/Standby", "Redis Cluster"];
const architectureOrder: DcsArchitecture[] = ["x86 | DRAM", "ARM | DRAM"];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function isDcsVersion(value: unknown): value is DcsVersion {
  return typeof value === "string" && versionOrder.includes(value as DcsVersion);
}

export function isDcsInstanceType(value: unknown): value is DcsInstanceType {
  return typeof value === "string" && instanceTypeOrder.includes(value as DcsInstanceType);
}

export function isDcsArchitecture(value: unknown): value is DcsArchitecture {
  return typeof value === "string" && architectureOrder.includes(value as DcsArchitecture);
}

export function isDcsBandwidthMode(value: unknown): value is DcsBandwidthMode {
  return value === "Buy now" || value === "Buy later";
}

export function listDcsVersions(catalog: DcsPricingCatalog) {
  const values = new Set<DcsVersion>();
  for (const tier of catalog.instanceTiers) {
    if (tier.prices.ONDEMAND != null) {
      values.add(tier.version);
    }
  }

  return orderedSet(values, versionOrder);
}

export function listDcsInstanceTypes(catalog: DcsPricingCatalog, version: DcsVersion) {
  const values = new Set<DcsInstanceType>();
  for (const tier of catalog.instanceTiers) {
    if (tier.version === version && tier.prices.ONDEMAND != null) {
      values.add(tier.instanceType);
    }
  }

  return orderedSet(values, instanceTypeOrder);
}

export function listDcsArchitectures(catalog: DcsPricingCatalog, options: { version: DcsVersion; instanceType: DcsInstanceType }) {
  const values = new Set<DcsArchitecture>();
  for (const tier of catalog.instanceTiers) {
    if (tier.version === options.version && tier.instanceType === options.instanceType && tier.prices.ONDEMAND != null) {
      values.add(tier.architecture);
    }
  }

  return orderedSet(values, architectureOrder);
}

export function listDcsReplicas(catalog: DcsPricingCatalog, options: { version: DcsVersion; instanceType: DcsInstanceType; architecture: DcsArchitecture }) {
  if (options.instanceType === "Single-node") {
    return [];
  }

  const values = new Set<number>();
  for (const tier of catalog.instanceTiers) {
    if (
      tier.version === options.version
      && tier.instanceType === options.instanceType
      && tier.architecture === options.architecture
      && tier.replicas != null
      && tier.prices.ONDEMAND != null
    ) {
      values.add(tier.replicas);
    }
  }

  return [...values].sort((left, right) => left - right);
}

export function listDcsSpecifications(
  catalog: DcsPricingCatalog,
  options: { version: DcsVersion; instanceType: DcsInstanceType; architecture: DcsArchitecture; replicas: number | null },
) {
  const values = new Map<number, string>();
  for (const tier of catalog.instanceTiers) {
    if (
      tier.version !== options.version
      || tier.instanceType !== options.instanceType
      || tier.architecture !== options.architecture
      || tier.prices.ONDEMAND == null
    ) {
      continue;
    }

    if (options.instanceType !== "Single-node" && tier.replicas !== options.replicas) {
      continue;
    }

    values.set(tier.memoryGiB, tier.specification);
  }

  return [...values.entries()].sort((left, right) => left[0] - right[0]).map(([, label]) => label);
}

export function findDcsInstanceTier(
  catalog: DcsPricingCatalog,
  options: { version: DcsVersion; instanceType: DcsInstanceType; architecture: DcsArchitecture; replicas: number | null; specification: string },
) {
  return catalog.instanceTiers.find((tier) =>
    tier.version === options.version
    && tier.instanceType === options.instanceType
    && tier.architecture === options.architecture
    && tier.specification === options.specification
    && (options.instanceType === "Single-node" ? true : tier.replicas === options.replicas)
  ) ?? null;
}

export function estimateDcsConfiguration(catalog: DcsPricingCatalog, input: DcsEstimateInput): DcsEstimate | null {
  if (input.edition !== "Basic") {
    return null;
  }

  const tier = findDcsInstanceTier(catalog, {
    version: input.version,
    instanceType: input.instanceType,
    architecture: input.architecture,
    replicas: input.instanceType === "Single-node" ? null : input.replicas,
    specification: input.specification,
  });
  if (!tier || tier.prices.ONDEMAND == null) {
    return null;
  }

  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }
  if (input.elasticBandwidth === "Buy now" && (!Number.isFinite(input.bandwidthMbit) || input.bandwidthMbit < 1)) {
    return null;
  }

  const quantity = Math.floor(input.quantity);
  const usageHours = Math.floor(input.usageHours);
  const bandwidthMbit = Math.floor(input.bandwidthMbit);

  if (input.elasticBandwidth === "Buy now" && catalog.bandwidthRatePerMbitHour == null) {
    return null;
  }

  const instanceAmount = tier.prices.ONDEMAND * quantity * usageHours;
  const bandwidthAmount = input.elasticBandwidth === "Buy now" && catalog.bandwidthRatePerMbitHour != null
    ? catalog.bandwidthRatePerMbitHour * bandwidthMbit * quantity * usageHours
    : 0;
  const amount = roundAmount(instanceAmount + bandwidthAmount);

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${usageHours}h`,
    monthlyAverageAmount: roundAmount(amount / (usageHours / (24 * 30))),
    quantity,
    usageHours,
    tier,
    bandwidthRatePerMbitHour: input.elasticBandwidth === "Buy now" ? catalog.bandwidthRatePerMbitHour : null,
    breakdown: [
      {
        label: `${quantity} x ${input.version} ${input.instanceType} ${input.architecture} ${input.specification}`,
        amount: roundAmount(instanceAmount),
      },
      ...(input.elasticBandwidth === "Buy now" && catalog.bandwidthRatePerMbitHour != null
        ? [{
            label: `${quantity} x elastic bandwidth ${bandwidthMbit} Mbit/s`,
            amount: roundAmount(bandwidthAmount),
          }]
        : []),
    ],
    notes: [
      `Instance rate: ${catalog.currency} ${tier.prices.ONDEMAND.toFixed(6)}/instance/h.`,
      ...(input.elasticBandwidth === "Buy now" && catalog.bandwidthRatePerMbitHour != null
        ? [`Bandwidth rate: ${catalog.currency} ${catalog.bandwidthRatePerMbitHour.toFixed(6)}/Mbit/s/h.`]
        : ["Elastic bandwidth is set to Buy later, so bandwidth is excluded from this estimate."]),
    ],
  };
}
