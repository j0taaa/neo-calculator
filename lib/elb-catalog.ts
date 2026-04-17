import type { PricingRateSet, RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type ElbType = "Shared load balancer" | "Dedicated load balancer";
export type ElbSpecificationType = "Fixed" | "Elastic";
export type ElbSubAz = "General AZ" | "Edge AZ";
export type ElbNetworkType = "Public network" | "Private network";
export type ElbInternetChargeMode = "By traffic" | "By bandwidth";
export type ElbBillingMode = "Pay-per-use" | "Yearly/Monthly";
export type ElbTrafficUnit = "GB" | "TB";
export type ElbFixedAvailabilityAzCount = number;
export type ElbFixedLoadBalancingType =
  | "Network load balancing (TCP/UDP/TLS)"
  | "Application load balancing (HTTP/HTTPS)";
export type ElbFixedSpecName =
  | "Small I"
  | "Small II"
  | "Medium I"
  | "Medium II"
  | "Large I"
  | "Large II";
export type ElbDedicatedProtocol =
  | "Network load balancing (TCP)"
  | "Network load balancing (UDP)"
  | "Network load balancing (TLS)"
  | "Application load balancing (HTTP/HTTPS)";

export type ElbRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface ElbPricingCatalog extends RegionalPricingCatalog {
  sharedRates: ElbRateSet;
  dedicatedRates: {
    fixed: Partial<Record<ElbSubAz, Partial<Record<number, Partial<Record<ElbDedicatedProtocol, number>>>>>>;
    elastic: Partial<Record<ElbSubAz, {
      basePerHour: number | null;
      lcuRates: Partial<Record<ElbDedicatedProtocol, number>>;
    }>>;
  };
  publicNetworkRates: {
    bandwidthPerMbitHour: number | null;
    trafficPerGb: number | null;
  };
}

export type ElbProtocolSectionInput = {
  newConnections: number;
  maxConcurrentConnections: number;
  metricMode: ElbInternetChargeMode;
  processedTrafficGbPerHour: number;
  averageBandwidthMbit: number;
  queriesPerSecond: number;
  forwardingRules: number;
};

export type ElbEstimateInput = {
  type: ElbType;
  specificationType: ElbSpecificationType;
  subAz: ElbSubAz;
  fixedAvailabilityAzCount: ElbFixedAvailabilityAzCount;
  fixedSelectedTypes: ElbFixedLoadBalancingType[];
  fixedTypeSpecs: Partial<Record<ElbFixedLoadBalancingType, ElbFixedSpecName>>;
  selectedProtocols: ElbDedicatedProtocol[];
  protocolInputs: Partial<Record<ElbDedicatedProtocol, ElbProtocolSectionInput>>;
  networkType: ElbNetworkType;
  billingMode: ElbBillingMode;
  sharedDurationHours: number;
  sharedChargeMode: ElbInternetChargeMode;
  sharedTrafficAmount: number;
  sharedTrafficUnit: ElbTrafficUnit;
  sharedBandwidthMbit: number;
};

export type ElbEstimateBreakdownItem = {
  key: "loadBalancer" | "lcu" | "publicBandwidth" | "publicTraffic";
  label: string;
  amount: number;
};

export type ElbProtocolLcuBreakdown = {
  protocol: ElbDedicatedProtocol;
  lcu: number;
  details: string[];
};

export type ElbEstimateResult = {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  breakdown: ElbEstimateBreakdownItem[];
  notes: string[];
  selectedSpecLcus: {
    network: number;
    application: number;
  };
  estimatedLcus: {
    network: number;
    application: number;
    total: number;
  };
  protocolBreakdowns: ElbProtocolLcuBreakdown[];
};

export const elbDedicatedProtocolOptions = [
  "Network load balancing (TCP)",
  "Network load balancing (UDP)",
  "Network load balancing (TLS)",
  "Application load balancing (HTTP/HTTPS)",
] as const satisfies readonly ElbDedicatedProtocol[];

export const elbFixedLoadBalancingTypeOptions = [
  "Network load balancing (TCP/UDP/TLS)",
  "Application load balancing (HTTP/HTTPS)",
] as const satisfies readonly ElbFixedLoadBalancingType[];
export const elbFixedSpecOptions = [
  "Small I",
  "Small II",
  "Medium I",
  "Medium II",
  "Large I",
  "Large II",
] as const satisfies readonly ElbFixedSpecName[];

export const elbTrafficUnitOptions = ["GB", "TB"] as const satisfies readonly ElbTrafficUnit[];

export const elbDefaults = {
  type: "Shared load balancer" as ElbType,
  specificationType: "Fixed" as ElbSpecificationType,
  subAz: "General AZ" as ElbSubAz,
  networkType: "Private network" as ElbNetworkType,
  sharedNetworkChargeMode: "By traffic" as ElbInternetChargeMode,
  sharedTrafficGb: 0,
  sharedBandwidthMbit: 5,
  fixedAvailabilityAzCount: 1 as ElbFixedAvailabilityAzCount,
  fixedSelectedTypes: ["Network load balancing (TCP/UDP/TLS)"] as ElbFixedLoadBalancingType[],
  fixedTypeSpecs: {
    "Network load balancing (TCP/UDP/TLS)": "Small I" as ElbFixedSpecName,
    "Application load balancing (HTTP/HTTPS)": "Small I" as ElbFixedSpecName,
  },
  selectedProtocols: ["Network load balancing (TCP)"] as ElbDedicatedProtocol[],
} as const;

export const elbPricingReference = {
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/elb.html",
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/elb",
  fixedDrawerAppUrl: "https://support.huaweicloud.com/intl/en-us/drawer-elb/elb_drawerhelp_004_01.html",
  fixedDrawerNetworkUrl: "https://support.huaweicloud.com/intl/en-us/drawer-elb/elb_drawerhelp_004_02.html",
} as const;

const fixedSpecLcuMap: Record<ElbFixedSpecName, number> = {
  "Small I": 10,
  "Small II": 20,
  "Medium I": 40,
  "Medium II": 100,
  "Large I": 200,
  "Large II": 400,
};

function roundElbAmount(value: number) {
  return Number(value.toFixed(5));
}

function ceilLcu(value: number) {
  return Math.max(0, Math.ceil(value));
}

function normalizeProtocolInput(input: ElbProtocolSectionInput | undefined): ElbProtocolSectionInput {
  return {
    newConnections: Math.max(0, input?.newConnections ?? 0),
    maxConcurrentConnections: Math.max(0, input?.maxConcurrentConnections ?? 0),
    metricMode: input?.metricMode === "By bandwidth" ? "By bandwidth" : "By traffic",
    processedTrafficGbPerHour: Math.max(0, input?.processedTrafficGbPerHour ?? 0),
    averageBandwidthMbit: Math.max(0, input?.averageBandwidthMbit ?? 0),
    queriesPerSecond: Math.max(0, input?.queriesPerSecond ?? 0),
    forwardingRules: Math.max(0, input?.forwardingRules ?? 0),
  };
}

function bandwidthToGbPerHour(mbit: number) {
  return Math.max(0, mbit) * 3600 / 8 / 1000;
}

function sharedTrafficToGb(amount: number, unit: ElbTrafficUnit) {
  return unit === "TB" ? amount * 1024 : amount;
}

function estimateProtocolLcu(protocol: ElbDedicatedProtocol, input: ElbProtocolSectionInput): ElbProtocolLcuBreakdown {
  const details: string[] = [];
  const trafficGbPerHour = input.metricMode === "By bandwidth"
    ? bandwidthToGbPerHour(input.averageBandwidthMbit)
    : input.processedTrafficGbPerHour;

  if (protocol === "Network load balancing (TCP)") {
    const lcu = Math.max(
      input.newConnections / 800,
      input.maxConcurrentConnections / 100_000,
      trafficGbPerHour / 1,
    );
    details.push(`CPS ${(input.newConnections / 800).toFixed(3)}`);
    details.push(`Connections ${(input.maxConcurrentConnections / 100_000).toFixed(3)}`);
    details.push(`Traffic ${(trafficGbPerHour / 1).toFixed(3)}`);
    return { protocol, lcu: ceilLcu(lcu), details };
  }

  if (protocol === "Network load balancing (UDP)") {
    const lcu = Math.max(
      input.newConnections / 50,
      input.maxConcurrentConnections / 3_000,
      trafficGbPerHour / 1,
    );
    details.push(`CPS ${(input.newConnections / 50).toFixed(3)}`);
    details.push(`Connections ${(input.maxConcurrentConnections / 3_000).toFixed(3)}`);
    details.push(`Traffic ${(trafficGbPerHour / 1).toFixed(3)}`);
    return { protocol, lcu: ceilLcu(lcu), details };
  }

  if (protocol === "Network load balancing (TLS)") {
    const lcu = Math.max(
      input.newConnections / 50,
      input.maxConcurrentConnections / 3_000,
      trafficGbPerHour / 1,
    );
    details.push(`CPS ${(input.newConnections / 50).toFixed(3)}`);
    details.push(`Connections ${(input.maxConcurrentConnections / 3_000).toFixed(3)}`);
    details.push(`Traffic ${(trafficGbPerHour / 1).toFixed(3)}`);
    return { protocol, lcu: ceilLcu(lcu), details };
  }

  const adjustedRuleQps = input.forwardingRules <= 10
    ? input.queriesPerSecond
    : input.queriesPerSecond * Math.max(1, input.forwardingRules - 10);
  const lcu = Math.max(
    input.newConnections / 25,
    input.maxConcurrentConnections / 3_000,
    trafficGbPerHour / 1,
    adjustedRuleQps / 1_000,
  );
  details.push(`CPS ${(input.newConnections / 25).toFixed(3)}`);
  details.push(`Connections ${(input.maxConcurrentConnections / 3_000).toFixed(3)}`);
  details.push(`Traffic ${(trafficGbPerHour / 1).toFixed(3)}`);
  details.push(`Rule eval ${(adjustedRuleQps / 1_000).toFixed(3)}`);
  return { protocol, lcu: ceilLcu(lcu), details };
}

function getElasticRateKey(protocol: ElbDedicatedProtocol): ElbDedicatedProtocol {
  if (protocol === "Network load balancing (UDP)" || protocol === "Network load balancing (TLS)") {
    return "Network load balancing (TCP)";
  }

  return protocol;
}

export function getElbBillingOptions(type: ElbType): ElbBillingMode[] {
  return type === "Shared load balancer" ? ["Pay-per-use", "Yearly/Monthly"] : ["Pay-per-use"];
}

export function shouldShowElbSharedChargeMode(type: ElbType, networkType: ElbNetworkType) {
  return networkType === "Public network";
}

export function shouldShowElbSharedBandwidth(type: ElbType, networkType: ElbNetworkType, mode: ElbInternetChargeMode) {
  return shouldShowElbSharedChargeMode(type, networkType) && mode === "By bandwidth";
}

export function shouldShowElbSharedTraffic(type: ElbType, networkType: ElbNetworkType, mode: ElbInternetChargeMode) {
  return shouldShowElbSharedChargeMode(type, networkType) && mode === "By traffic";
}

export function estimateElbConfiguration(catalog: ElbPricingCatalog, input: ElbEstimateInput): ElbEstimateResult | null {
  const notes: string[] = [];
  let loadBalancerCost = 0;
  let lcuCost = 0;
  let publicBandwidthCost = 0;
  let publicTrafficCost = 0;
  let suffix = "/mo";
  const protocolBreakdowns: ElbProtocolLcuBreakdown[] = [];
  let estimatedNetworkLcus = 0;
  let estimatedApplicationLcus = 0;
  let selectedNetworkSpecLcus = 0;
  let selectedApplicationSpecLcus = 0;

  if (input.type === "Shared load balancer") {
    if (input.billingMode === "Pay-per-use") {
      const hourlyRate = catalog.sharedRates.ONDEMAND;
      if (hourlyRate == null) {
        return null;
      }
      loadBalancerCost = hourlyRate * input.sharedDurationHours;
      suffix = `/${input.sharedDurationHours}h`;
    } else {
      const monthlyRate = catalog.sharedRates.MONTHLY;
      if (monthlyRate == null) {
        return null;
      }
      loadBalancerCost = monthlyRate;
      suffix = "/mo";
    }

    if (input.networkType === "Public network") {
      if (input.sharedChargeMode === "By bandwidth") {
        const rate = catalog.publicNetworkRates.bandwidthPerMbitHour;
        if (rate == null) {
          return null;
        }
        publicBandwidthCost = rate * input.sharedBandwidthMbit * input.sharedDurationHours;
      } else {
        const rate = catalog.publicNetworkRates.trafficPerGb;
        if (rate == null) {
          return null;
        }
        publicTrafficCost = rate * sharedTrafficToGb(input.sharedTrafficAmount, input.sharedTrafficUnit);
      }
    }
  } else {
    if (input.specificationType === "Elastic") {
      const selectedProtocols = input.selectedProtocols.length > 0 ? input.selectedProtocols : elbDefaults.selectedProtocols;
      for (const protocol of selectedProtocols) {
        const breakdown = estimateProtocolLcu(protocol, normalizeProtocolInput(input.protocolInputs[protocol]));
        protocolBreakdowns.push(breakdown);
        if (protocol === "Application load balancing (HTTP/HTTPS)") {
          estimatedApplicationLcus += breakdown.lcu;
        } else {
          estimatedNetworkLcus += breakdown.lcu;
        }
      }
    }

    if (input.specificationType === "Elastic") {
      const elasticRateSet = catalog.dedicatedRates.elastic[input.subAz];
      if (!elasticRateSet || elasticRateSet.basePerHour == null) {
        return null;
      }

      loadBalancerCost = elasticRateSet.basePerHour * input.sharedDurationHours;
      for (const breakdown of protocolBreakdowns) {
        const protocolRate = elasticRateSet.lcuRates[getElasticRateKey(breakdown.protocol)];
        if (protocolRate == null) {
          return null;
        }
        lcuCost += protocolRate * breakdown.lcu * input.sharedDurationHours;
      }
      notes.push("Dedicated elastic pricing includes a base load balancer charge plus protocol-specific LCU usage.");
      suffix = `/${input.sharedDurationHours}h`;
    } else {
      const fixedRateSet = catalog.dedicatedRates.fixed[input.subAz]?.[input.fixedAvailabilityAzCount];
      if (!fixedRateSet) {
        return null;
      }

      selectedNetworkSpecLcus = input.fixedSelectedTypes.includes("Network load balancing (TCP/UDP/TLS)")
        ? fixedSpecLcuMap[input.fixedTypeSpecs["Network load balancing (TCP/UDP/TLS)"] ?? "Small I"]
        : 0;
      selectedApplicationSpecLcus = input.fixedSelectedTypes.includes("Application load balancing (HTTP/HTTPS)")
        ? fixedSpecLcuMap[input.fixedTypeSpecs["Application load balancing (HTTP/HTTPS)"] ?? "Small I"]
        : 0;

      if (selectedNetworkSpecLcus > 0) {
        const networkRate = fixedRateSet["Network load balancing (TCP)"];
        if (networkRate == null) {
          return null;
        }
        lcuCost += networkRate * selectedNetworkSpecLcus * input.sharedDurationHours;
      }

      if (selectedApplicationSpecLcus > 0) {
        const appRate = fixedRateSet["Application load balancing (HTTP/HTTPS)"];
        if (appRate == null) {
          return null;
        }
        lcuCost += appRate * selectedApplicationSpecLcus * input.sharedDurationHours;
      }

      estimatedNetworkLcus = selectedNetworkSpecLcus;
      estimatedApplicationLcus = selectedApplicationSpecLcus;
      notes.push(`Dedicated fixed pricing uses the ${input.fixedAvailabilityAzCount}-AZ fixed SKU rate from Huawei's catalog.`);
      suffix = `/${input.sharedDurationHours}h`;
    }
  }

  if (input.type === "Dedicated load balancer" && input.networkType === "Public network") {
    if (input.sharedChargeMode === "By bandwidth") {
      const rate = catalog.publicNetworkRates.bandwidthPerMbitHour;
      if (rate == null) {
        return null;
      }
      publicBandwidthCost += rate * input.sharedBandwidthMbit * input.sharedDurationHours;
    } else {
      const rate = catalog.publicNetworkRates.trafficPerGb;
      if (rate == null) {
        return null;
      }
      publicTrafficCost += rate * sharedTrafficToGb(input.sharedTrafficAmount, input.sharedTrafficUnit);
    }
  }

  const amount = roundElbAmount(loadBalancerCost + lcuCost + publicBandwidthCost + publicTrafficCost);
  const monthlyAverageAmount = input.billingMode === "Pay-per-use"
    ? roundElbAmount(amount / (input.sharedDurationHours / 24 / 30))
    : amount;

  return {
    currency: catalog.currency,
    amount,
    suffix,
    monthlyAverageAmount,
    breakdown: [
      { key: "loadBalancer", label: "Load balancer", amount: roundElbAmount(loadBalancerCost) } satisfies ElbEstimateBreakdownItem,
      { key: "lcu", label: "Estimated LCUs", amount: roundElbAmount(lcuCost) } satisfies ElbEstimateBreakdownItem,
      { key: "publicBandwidth", label: "Public bandwidth", amount: roundElbAmount(publicBandwidthCost) } satisfies ElbEstimateBreakdownItem,
      { key: "publicTraffic", label: "Public traffic", amount: roundElbAmount(publicTrafficCost) } satisfies ElbEstimateBreakdownItem,
    ].filter((entry) => entry.amount > 0),
    notes,
    selectedSpecLcus: {
      network: selectedNetworkSpecLcus,
      application: selectedApplicationSpecLcus,
    },
    estimatedLcus: {
      network: estimatedNetworkLcus,
      application: estimatedApplicationLcus,
      total: estimatedNetworkLcus + estimatedApplicationLcus,
    },
    protocolBreakdowns,
  };
}
