import { orderedSet, type PricingRateSet, type PricingProductIdSet, type RegionalPricingCatalog, type ResourcePricingTierWithProducts } from "@/lib/pricing-catalog-types";

export type DmsBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

export interface DmsFlavorTier extends ResourcePricingTierWithProducts<DmsBillingMode> {
  flavor: string;
  label: string;
}

export interface DmsBandwidthTier extends ResourcePricingTierWithProducts<DmsBillingMode> {
  bandwidth: string;
  label: string;
  bandwidthMbps: number;
}

export interface DmsStorageTier extends ResourcePricingTierWithProducts<DmsBillingMode> {
  storageType: string;
  label: string;
}

export interface DmsPricingCatalog extends RegionalPricingCatalog {
  flavors: DmsFlavorTier[];
  bandwidths: DmsBandwidthTier[];
  storageTypes: DmsStorageTier[];
}

export interface DmsEstimateInput {
  flavor: string;
  brokers: number;
  bandwidth: string;
  storageType: string;
  storageGb: number;
  quantity: number;
  usageHours: number;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
  durationMonths?: number;
}

export interface DmsEstimateBreakdownItem {
  label: string;
  amount: number;
}

export interface DmsEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number | null;
  quantity: number;
  brokers: number;
  usageHours: number;
  flavorTier: DmsFlavorTier | null;
  bandwidthTier: DmsBandwidthTier | null;
  storageTier: DmsStorageTier | null;
  billingMode: string;
  breakdown: DmsEstimateBreakdownItem[];
  notes: string[];
}

export const dmsDefaults = {
  flavor: "kafka.2u4g.cluster.small",
  brokers: 3,
  bandwidth: "100MB/s",
  storageType: "Ultra-high I/O",
  storageGb: 10,
  quantity: 1,
  usageHours: 744,
} as const;

export const dmsPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/kafka",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/dms.html",
} as const;

const flavorOrder = [
  "kafka.2u4g.cluster.small",
  "kafka.2u4g.cluster",
  "kafka.4u8g.cluster",
  "kafka.8u16g.cluster",
  "kafka.12u24g.cluster",
  "kafka.16u32g.cluster",
];

const bandwidthOrder = [
  "100MB/s",
  "300MB/s",
  "600MB/s",
  "1200MB/s",
];

const storageTypeOrder = [
  "Extreme SSD",
  "Ultra-high I/O",
  "General Purpose SSD",
  "High I/O",
];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

export function listDmsFlavors(catalog: DmsPricingCatalog, billingMode?: "Pay-per-use" | "Yearly/Monthly"): string[] {
  const values = new Set<string>();
  for (const tier of catalog.flavors) {
    if (billingMode === "Pay-per-use") {
      if (tier.prices.ONDEMAND == null) continue;
    } else {
      if (tier.prices.MONTHLY == null && tier.prices.YEARLY == null) continue;
    }
    values.add(tier.flavor);
  }
  return orderedSet(values, flavorOrder);
}

export function listDmsBandwidths(catalog: DmsPricingCatalog, billingMode?: "Pay-per-use" | "Yearly/Monthly"): string[] {
  const values = new Set<string>();
  for (const tier of catalog.bandwidths) {
    if (billingMode === "Pay-per-use") {
      if (tier.prices.ONDEMAND == null) continue;
    } else {
      if (tier.prices.MONTHLY == null && tier.prices.YEARLY == null) continue;
    }
    values.add(tier.bandwidth);
  }
  return orderedSet(values, bandwidthOrder);
}

export function listDmsStorageTypes(catalog: DmsPricingCatalog, billingMode?: "Pay-per-use" | "Yearly/Monthly"): string[] {
  const values = new Set<string>();
  for (const tier of catalog.storageTypes) {
    if (billingMode === "Pay-per-use") {
      if (tier.prices.ONDEMAND == null) continue;
    } else {
      if (tier.prices.MONTHLY == null && tier.prices.YEARLY == null) continue;
    }
    values.add(tier.storageType);
  }
  return orderedSet(values, storageTypeOrder);
}

export function findDmsFlavor(catalog: DmsPricingCatalog, flavor: string): DmsFlavorTier | null {
  return catalog.flavors.find((t) => t.flavor === flavor) ?? null;
}

export function findDmsBandwidth(catalog: DmsPricingCatalog, bandwidth: string): DmsBandwidthTier | null {
  return catalog.bandwidths.find((t) => t.bandwidth === bandwidth) ?? null;
}

export function findDmsStorageType(catalog: DmsPricingCatalog, storageType: string): DmsStorageTier | null {
  return catalog.storageTypes.find((t) => t.storageType === storageType) ?? null;
}

export function estimateDmsConfiguration(catalog: DmsPricingCatalog, input: DmsEstimateInput): DmsEstimate | null {
  const flavorTier = findDmsFlavor(catalog, input.flavor);
  const bandwidthTier = findDmsBandwidth(catalog, input.bandwidth);
  const storageTier = findDmsStorageType(catalog, input.storageType);

  if (!flavorTier && !bandwidthTier && !storageTier) return null;

  const quantity = Math.max(1, Math.floor(input.quantity));
  const brokers = Math.max(1, Math.floor(input.brokers));
  const storageGb = Math.max(1, Math.floor(input.storageGb));
  const usageHours = Math.max(1, Math.floor(input.usageHours));

  const breakdown: DmsEstimateBreakdownItem[] = [];
  const notes: string[] = [];

  if (input.billingMode === "Pay-per-use") {
    let total = 0;

    if (flavorTier && flavorTier.prices.ONDEMAND != null) {
      const flavorAmount = roundAmount(flavorTier.prices.ONDEMAND * quantity * usageHours);
      total += flavorAmount;
      breakdown.push({ label: `${quantity} x ${brokers} brokers x ${flavorTier.flavor}`, amount: flavorAmount });
      notes.push(`Flavor rate: ${catalog.currency} ${flavorTier.prices.ONDEMAND.toFixed(4)}/instance/h.`);
    }

    if (bandwidthTier && bandwidthTier.prices.ONDEMAND != null) {
      const bwAmount = roundAmount(bandwidthTier.prices.ONDEMAND * quantity * usageHours);
      total += bwAmount;
      breakdown.push({ label: `${quantity} x Bandwidth ${bandwidthTier.bandwidth}`, amount: bwAmount });
      notes.push(`Bandwidth rate: ${catalog.currency} ${bandwidthTier.prices.ONDEMAND.toFixed(4)}/instance/h.`);
    }

    if (storageTier && storageTier.prices.ONDEMAND != null) {
      const storageHours = usageHours;
      const storageAmount = roundAmount(storageTier.prices.ONDEMAND * storageGb * brokers * quantity * storageHours);
      total += storageAmount;
      breakdown.push({ label: `${quantity} x ${storageGb} GB x ${brokers} brokers x ${storageTier.storageType}`, amount: storageAmount });
      notes.push(`Storage rate: ${catalog.currency} ${storageTier.prices.ONDEMAND.toFixed(4)}/GB/broker/h.`);
    }

    if (breakdown.length === 0) return null;

    return {
      currency: catalog.currency,
      amount: roundAmount(total),
      suffix: `/${usageHours}h`,
      monthlyAverageAmount: roundAmount(total / (usageHours / (24 * 30))),
      quantity,
      brokers,
      usageHours,
      flavorTier,
      bandwidthTier,
      storageTier,
      billingMode: "Pay-per-use",
      breakdown,
      notes,
    };
  }

  const durationMonths = input.durationMonths ?? 1;
  let total = 0;

  if (flavorTier) {
    const monthly = flavorTier.prices.MONTHLY;
    const yearly = flavorTier.prices.YEARLY;
    if (monthly != null) {
      const amt = Math.round(monthly) * durationMonths * quantity;
      total += amt;
      breakdown.push({ label: `${quantity} x ${brokers} brokers x ${flavorTier.flavor} (${durationMonths}mo)`, amount: amt });
      notes.push(`Flavor rate: ${catalog.currency} ${monthly.toFixed(2)}/mo/instance.`);
    } else if (yearly != null) {
      const amt = Math.round(yearly) * quantity;
      total += amt;
      breakdown.push({ label: `${quantity} x ${brokers} brokers x ${flavorTier.flavor} (1yr)`, amount: amt });
      notes.push(`Flavor rate: ${catalog.currency} ${yearly.toFixed(2)}/yr/instance.`);
    }
  }

  if (bandwidthTier) {
    const monthly = bandwidthTier.prices.MONTHLY;
    const yearly = bandwidthTier.prices.YEARLY;
    if (monthly != null) {
      const amt = Math.round(monthly) * durationMonths * quantity;
      total += amt;
      breakdown.push({ label: `${quantity} x Bandwidth ${bandwidthTier.bandwidth} (${durationMonths}mo)`, amount: amt });
    } else if (yearly != null) {
      const amt = Math.round(yearly) * quantity;
      total += amt;
      breakdown.push({ label: `${quantity} x Bandwidth ${bandwidthTier.bandwidth} (1yr)`, amount: amt });
    }
  }

  if (storageTier) {
    const monthly = storageTier.prices.MONTHLY;
    const yearly = storageTier.prices.YEARLY;
    if (monthly != null) {
      const amt = Math.round(monthly) * storageGb * brokers * quantity;
      total += amt;
      breakdown.push({ label: `${quantity} x ${storageGb} GB x ${brokers} brokers x ${storageTier.storageType} (${durationMonths}mo)`, amount: amt });
      notes.push(`Storage rate: ${catalog.currency} ${monthly.toFixed(2)}/mo/GB.`);
    } else if (yearly != null) {
      const amt = Math.round(yearly) * storageGb * brokers * quantity;
      total += amt;
      breakdown.push({ label: `${quantity} x ${storageGb} GB x ${brokers} brokers x ${storageTier.storageType} (1yr)`, amount: amt });
      notes.push(`Storage rate: ${catalog.currency} ${yearly.toFixed(2)}/yr/GB.`);
    }
  }

  if (breakdown.length === 0) return null;

  const suffix = durationMonths === 1 ? "/mo" : `/${durationMonths}mo`;

  return {
    currency: catalog.currency,
    amount: roundAmount(total),
    suffix,
    monthlyAverageAmount: roundAmount(total),
    quantity,
    brokers,
    usageHours: 744 * durationMonths,
    flavorTier,
    bandwidthTier,
    storageTier,
    billingMode: "Yearly/Monthly",
    breakdown,
    notes,
  };
}
