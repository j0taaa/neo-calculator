import type { AmountPlan, BillingPeriodPlan, RegionalPricingCatalog, UsageDivisionRate } from "@/lib/pricing-catalog-types";

export type VpnEdition = "Classic" | "Enterprise";
export type VpnMode = "Site-to-Cloud" | "Point-to-Cloud";
export type VpnNetworkType = "Public network" | "Private network";
export type VpnSpecification = "Professional 1" | "Professional 2" | "Basic";
export type VpnAccessViaNonFixedIp = "Off" | "On";
export type VpnBillingMode = "Pay-per-use" | "Yearly/Monthly";
export type VpnBandwidthAllocation = "Dedicated bandwidth" | "Shared bandwidth";
export type VpnCatalogBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

export type VpnDivisionRate = UsageDivisionRate;

export interface VpnGatewayPlan extends BillingPeriodPlan<VpnCatalogBillingMode> {
  tiers: VpnDivisionRate[];
}

export type VpnGatewayTier = {
  mode: VpnMode;
  specification: VpnSpecification;
  accessViaNonFixedIp: VpnAccessViaNonFixedIp;
  resourceSpecCode: string;
  plans: VpnGatewayPlan[];
};

export type VpnBandwidthPlan = AmountPlan<VpnCatalogBillingMode>;

export type VpnBandwidthTier = {
  allocation: VpnBandwidthAllocation;
  resourceSpecCode: string;
  plans: VpnBandwidthPlan[];
};

export type VpnPricingCatalog = RegionalPricingCatalog & {
  gateways: VpnGatewayTier[];
  publicBandwidth: VpnBandwidthTier[];
};

export type VpnEstimateInput = {
  mode: VpnMode;
  networkType: VpnNetworkType;
  specification: VpnSpecification;
  billingMode: VpnBillingMode;
  accessViaNonFixedIp: VpnAccessViaNonFixedIp;
  connectionGroups: number;
  useSharedBandwidth: boolean;
  eipBandwidthMbit1: number;
  eipBandwidthMbit2: number;
  usageHours: number;
  durationMonths: number;
};

export type VpnEstimateBreakdownItem = {
  key: "gateway" | "publicBandwidth";
  label: string;
  amount: number;
};

export type VpnEstimateResult = {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  breakdown: VpnEstimateBreakdownItem[];
  notes: string[];
  gatewayTier: VpnGatewayTier;
  bandwidthTier: VpnBandwidthTier | null;
};

const DEFAULT_CURRENCY = "USD";
const DEFAULT_REGION = "ap-southeast-1";

const fallbackCatalog: VpnPricingCatalog = {
  currency: DEFAULT_CURRENCY,
  regionId: DEFAULT_REGION,
  gateways: [],
  publicBandwidth: [],
};

export const vpnEditionOptions = ["Classic", "Enterprise"] as const satisfies readonly VpnEdition[];
export const vpnModeOptions = ["Site-to-Cloud", "Point-to-Cloud"] as const satisfies readonly VpnMode[];
export const vpnNetworkTypeOptions = ["Public network", "Private network"] as const satisfies readonly VpnNetworkType[];
export const vpnAccessViaNonFixedIpOptions = ["Off", "On"] as const satisfies readonly VpnAccessViaNonFixedIp[];
export const vpnConnectionGroupOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export const vpnDurationMonthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 24, 36] as const;

export const vpnDefaults = {
  edition: "Classic" as VpnEdition,
  mode: "Site-to-Cloud" as VpnMode,
  networkType: "Private network" as VpnNetworkType,
  accessViaNonFixedIp: "Off" as VpnAccessViaNonFixedIp,
  connectionGroups: 1,
  useSharedBandwidth: false,
  eipBandwidthMbit1: 1,
  eipBandwidthMbit2: 1,
  durationMonths: 1,
} as const;

export const vpnPricingReference = {
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/vpn.html",
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/vpn",
  specsUrl: "https://support.huaweicloud.com/intl/en-us/productdesc-vpn/vpn_productdesc_0004.html",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
} as const;

function roundVpnAmount(value: number) {
  return Number(value.toFixed(5));
}

function sortByRangeStart<T extends { start: number }>(entries: readonly T[]) {
  return [...entries].sort((left, right) => left.start - right.start);
}

function isFlatRatePlan(tiers: readonly VpnDivisionRate[]): boolean {
  return tiers.length === 1 && tiers[0].start === 0 && tiers[0].end === null;
}

function estimateDivisionAmount(tiers: readonly VpnDivisionRate[], quantity: number) {
  const normalizedQuantity = Math.max(1, Number.isFinite(quantity) ? quantity : 1);
  let total = 0;

  for (const tier of sortByRangeStart(tiers)) {
    const upperBound = tier.end == null ? normalizedQuantity : Math.min(normalizedQuantity, tier.end);
    const overlap = Math.max(0, upperBound - tier.start);
    if (overlap > 0) {
      total += overlap * tier.amount;
    }
  }

  return roundVpnAmount(total);
}

function findGatewayTier(
  catalog: VpnPricingCatalog,
  mode: VpnMode,
  networkType: VpnNetworkType,
  specification: VpnSpecification,
  accessViaNonFixedIp: VpnAccessViaNonFixedIp,
) {
  if (mode === "Point-to-Cloud") {
    return catalog.gateways.find((tier) => tier.mode === "Point-to-Cloud" && tier.specification === specification) ?? null;
  }

  if (networkType === "Public network" && accessViaNonFixedIp === "Off") {
    return catalog.gateways.find((tier) => tier.mode === "Site-to-Cloud" && tier.specification === specification && tier.accessViaNonFixedIp === "Off") ?? null;
  }

  return catalog.gateways.find((tier) => tier.mode === "Site-to-Cloud" && tier.specification === specification && tier.accessViaNonFixedIp === "On") ?? null;
}

function findGatewayPlan(
  tier: VpnGatewayTier,
  billingMode: VpnCatalogBillingMode,
  periodNum: number | null,
) {
  return tier.plans.find((plan) => plan.billingMode === billingMode && plan.periodNum === periodNum) ?? null;
}

function findBandwidthTier(catalog: VpnPricingCatalog, useSharedBandwidth: boolean) {
  return catalog.publicBandwidth.find((tier) => tier.allocation === (useSharedBandwidth ? "Shared bandwidth" : "Dedicated bandwidth")) ?? null;
}

function findBandwidthPlan(
  tier: VpnBandwidthTier,
  billingMode: VpnCatalogBillingMode,
  periodNum: number | null,
) {
  return tier.plans.find((plan) => plan.billingMode === billingMode && plan.periodNum === periodNum) ?? null;
}

function getNormalizedDurationMonths(value: number) {
  const normalized = Number.isFinite(value) ? Math.floor(value) : NaN;
  return vpnDurationMonthOptions.includes(normalized as (typeof vpnDurationMonthOptions)[number])
    ? normalized
    : null;
}

export function getFallbackVpnPricingCatalog(): VpnPricingCatalog {
  return fallbackCatalog;
}

export function listVpnModes(
  catalog: VpnPricingCatalog = fallbackCatalog,
  options?: {
    billingMode?: VpnBillingMode;
    edition?: VpnEdition;
  },
): VpnMode[] {
  let filteredGateways = catalog.gateways;

  if (options?.edition === "Classic") {
    filteredGateways = filteredGateways.filter((tier) => tier.specification === "Basic");
  } else if (options?.edition === "Enterprise") {
    filteredGateways = filteredGateways.filter((tier) => tier.specification !== "Basic");
  }

  if (options?.billingMode === "Pay-per-use") {
    filteredGateways = filteredGateways.filter((tier) =>
      tier.plans.some((plan) => plan.billingMode === "ONDEMAND")
    );
  } else if (options?.billingMode === "Yearly/Monthly") {
    filteredGateways = filteredGateways.filter((tier) =>
      tier.plans.some((plan) => plan.billingMode === "MONTHLY" || plan.billingMode === "YEARLY")
    );
  }

  const values = new Set<VpnMode>(filteredGateways.map((tier) => tier.mode));
  return vpnModeOptions.filter((value) => values.size === 0 || values.has(value));
}

export function listVpnSpecifications(mode: VpnMode, catalog: VpnPricingCatalog = fallbackCatalog): VpnSpecification[] {
  const values = new Set<VpnSpecification>(
    catalog.gateways
      .filter((tier) => tier.mode === mode)
      .map((tier) => tier.specification),
  );

  return (["Professional 1", "Professional 2", "Basic"] as const).filter((value) => values.size === 0 || values.has(value));
}

export function shouldShowVpnAccessViaNonFixedIp(mode: VpnMode, networkType: VpnNetworkType) {
  return mode === "Site-to-Cloud" && networkType === "Public network";
}

export function shouldShowVpnNetworkType(edition: VpnEdition) {
  return edition === "Enterprise";
}

export function shouldShowVpnConnectionGroups(edition: VpnEdition) {
  return edition === "Enterprise";
}

export function shouldShowVpnEipGroup(edition: VpnEdition) {
  return edition === "Enterprise";
}

export function shouldShowVpnPublicBandwidth(edition: VpnEdition, networkType: VpnNetworkType) {
  return edition === "Enterprise" && networkType === "Public network";
}

export function getVpnBillingOptions(
  catalog: VpnPricingCatalog,
  selection: Pick<VpnEstimateInput, "mode" | "networkType" | "specification" | "accessViaNonFixedIp">,
): VpnBillingMode[] {
  const gatewayTier = findGatewayTier(catalog, selection.mode, selection.networkType, selection.specification, selection.accessViaNonFixedIp);
  if (!gatewayTier) {
    return ["Yearly/Monthly"];
  }

  const options: VpnBillingMode[] = [];
  if (gatewayTier.plans.some((plan) => plan.billingMode === "MONTHLY" || plan.billingMode === "YEARLY")) {
    options.push("Yearly/Monthly");
  }
  if (gatewayTier.plans.some((plan) => plan.billingMode === "ONDEMAND")) {
    options.unshift("Pay-per-use");
  }

  return options.length > 0 ? options : ["Yearly/Monthly"];
}

export function estimateVpnConfiguration(catalog: VpnPricingCatalog, input: VpnEstimateInput): VpnEstimateResult | null {
  const gatewayTier = findGatewayTier(catalog, input.mode, input.networkType, input.specification, input.accessViaNonFixedIp);
  if (!gatewayTier) {
    return null;
  }

  if (!Number.isFinite(input.connectionGroups) || input.connectionGroups < 1) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }

  const normalizedConnectionGroups = input.connectionGroups;
  const normalizedUsageHours = input.usageHours;
  const normalizedDurationMonths = getNormalizedDurationMonths(input.durationMonths);
  if (normalizedDurationMonths == null) {
    return null;
  }
  const breakdown: VpnEstimateBreakdownItem[] = [];
  const notes: string[] = [];
  let amount = 0;
  let suffix = "/mo";
  let bandwidthTier: VpnBandwidthTier | null = null;

  if (input.billingMode === "Pay-per-use") {
    const gatewayPlan = findGatewayPlan(gatewayTier, "ONDEMAND", null);
    if (!gatewayPlan) {
      return null;
    }

    let gatewayHourly: number;
    if (isFlatRatePlan(gatewayPlan.tiers)) {
      gatewayHourly = gatewayPlan.tiers[0].amount;
    } else {
      gatewayHourly = estimateDivisionAmount(gatewayPlan.tiers, normalizedConnectionGroups);
    }
    const gatewayCost = roundVpnAmount(gatewayHourly * normalizedUsageHours);
    amount += gatewayCost;
    breakdown.push({ key: "gateway", label: "VPN gateway", amount: gatewayCost });
    if (isFlatRatePlan(gatewayPlan.tiers)) {
      notes.push(`Gateway pay-per-use flat rate: ${catalog.currency} ${formatDivisionPreview(gatewayHourly)}/h.`);
    } else {
      notes.push(`Gateway pay-per-use rate: ${catalog.currency} ${formatDivisionPreview(gatewayHourly)}/h for ${normalizedConnectionGroups} connection groups.`);
    }

    if (input.networkType === "Public network" && input.specification !== "Basic") {
      bandwidthTier = findBandwidthTier(catalog, input.useSharedBandwidth);
      if (!bandwidthTier) {
        return null;
      }

      const bandwidthPlan = findBandwidthPlan(bandwidthTier, "ONDEMAND", null);
      if (!bandwidthPlan) {
        return null;
      }

      const totalBandwidthMbit = Math.max(0, input.eipBandwidthMbit1) + Math.max(0, input.eipBandwidthMbit2);
      const bandwidthCost = roundVpnAmount(bandwidthPlan.amount * totalBandwidthMbit * normalizedUsageHours);
      amount += bandwidthCost;
      breakdown.push({ key: "publicBandwidth", label: "Public bandwidth", amount: bandwidthCost });
      notes.push(`${bandwidthTier.allocation} rate: ${catalog.currency} ${formatDivisionPreview(bandwidthPlan.amount)}/Mbit/s/h across both EIPs.`);
    }

    suffix = `/${normalizedUsageHours}h`;
    return {
      currency: catalog.currency,
      amount: roundVpnAmount(amount),
      suffix,
      monthlyAverageAmount: roundVpnAmount(amount / (normalizedUsageHours / (24 * 30))),
      breakdown,
      notes,
      gatewayTier,
      bandwidthTier,
    };
  }

  const totalBandwidthMbit = Math.max(0, input.eipBandwidthMbit1) + Math.max(0, input.eipBandwidthMbit2);
  const isYearTerm = normalizedDurationMonths >= 12;

  if (isYearTerm) {
    const years = normalizedDurationMonths / 12;
    const gatewayPlan = findGatewayPlan(gatewayTier, "YEARLY", years);
    if (!gatewayPlan) {
      return null;
    }

    const gatewayCost = estimateDivisionAmount(gatewayPlan.tiers, normalizedConnectionGroups);
    amount += gatewayCost;
    breakdown.push({ key: "gateway", label: "VPN gateway", amount: gatewayCost });

    if (input.networkType === "Public network" && input.specification !== "Basic") {
      bandwidthTier = findBandwidthTier(catalog, input.useSharedBandwidth);
      if (!bandwidthTier) {
        return null;
      }

      const bandwidthPlan = findBandwidthPlan(bandwidthTier, "YEARLY", years);
      if (!bandwidthPlan) {
        return null;
      }

      const bandwidthCost = roundVpnAmount(bandwidthPlan.amount * totalBandwidthMbit);
      amount += bandwidthCost;
      breakdown.push({ key: "publicBandwidth", label: "Public bandwidth", amount: bandwidthCost });
    }

    suffix = `/${years}yr`;
  } else {
    const gatewayPlan = findGatewayPlan(gatewayTier, "MONTHLY", 1);
    if (!gatewayPlan) {
      return null;
    }

    const gatewayMonthly = estimateDivisionAmount(gatewayPlan.tiers, normalizedConnectionGroups);
    const gatewayCost = roundVpnAmount(gatewayMonthly * normalizedDurationMonths);
    amount += gatewayCost;
    breakdown.push({ key: "gateway", label: "VPN gateway", amount: gatewayCost });

    if (input.networkType === "Public network" && input.specification !== "Basic") {
      bandwidthTier = findBandwidthTier(catalog, input.useSharedBandwidth);
      if (!bandwidthTier) {
        return null;
      }

      const bandwidthPlan = findBandwidthPlan(bandwidthTier, "MONTHLY", 1);
      if (!bandwidthPlan) {
        return null;
      }

      const bandwidthCost = roundVpnAmount(bandwidthPlan.amount * totalBandwidthMbit * normalizedDurationMonths);
      amount += bandwidthCost;
      breakdown.push({ key: "publicBandwidth", label: "Public bandwidth", amount: bandwidthCost });
    }

    suffix = `/${normalizedDurationMonths}mo`;
  }

  notes.push(`${gatewayTier.specification} ${gatewayTier.mode} gateway with ${normalizedConnectionGroups} connection groups.`);
  if (bandwidthTier) {
    notes.push(`Public-network pricing uses ${bandwidthTier.allocation.toLowerCase()} catalog rates across the two EIPs shown in Huawei's VPN calculator.`);
  }

  return {
    currency: catalog.currency,
    amount: roundVpnAmount(amount),
    suffix,
    monthlyAverageAmount: roundVpnAmount(amount / normalizedDurationMonths),
    breakdown,
    notes,
    gatewayTier,
    bandwidthTier,
  };
}

function formatDivisionPreview(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}
