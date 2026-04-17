import type { CapacityRateTier, PricingRateSet, RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type EipType = "Dedicated EIP" | "Shared EIP";
export type EipChargeMode = "By bandwidth" | "By traffic" | "Enhanced 95";
export type EipTrafficUnit = "GB" | "TB";

export type EipCatalogRateSet = PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY">;

export interface EipTrafficTier extends CapacityRateTier {
  startGb: number;
}

export type EipTrafficPackage = {
  billingMode: "MONTHLY" | "YEARLY";
  sizeGb: number;
  amount: number;
  resourceSpecCode: string;
  productId: string | null;
};

export type EipPricingCatalog = RegionalPricingCatalog & {
  dedicated: {
    eipRates: EipCatalogRateSet;
    bandwidthRates: EipCatalogRateSet;
    trafficRatePerGb: number | null;
    trafficRateTiers: EipTrafficTier[];
    trafficPackages: Record<"MONTHLY" | "YEARLY", EipTrafficPackage[]>;
  };
  shared: {
    bandwidthRates: EipCatalogRateSet;
    enhanced95MonthlyBaseRate: number | null;
  };
};

export type EipEstimateInput = {
  type: EipType;
  chargeMode: EipChargeMode;
  billingMode: "Pay-per-use" | "Yearly/Monthly";
  durationHours: number;
  durationMonths: number;
  bandwidthMbit: number;
  sharedBandwidthQuantity: number;
  trafficAmount: number;
  trafficUnit: EipTrafficUnit;
};

export type EipEstimateBreakdownItem = {
  key: "eip" | "bandwidth" | "traffic" | "enhanced95";
  label: string;
  amount: number;
};

export type EipPackageSelectionItem = {
  sizeGb: number;
  count: number;
  amount: number;
};

export type EipEstimateResult = {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  breakdown: EipEstimateBreakdownItem[];
  notes: string[];
  packageSelection: EipPackageSelectionItem[];
};

export const eipTypeOptions = ["Dedicated EIP", "Shared EIP"] as const satisfies readonly EipType[];
export const eipDedicatedChargeModeOptions = ["By bandwidth", "By traffic"] as const satisfies readonly EipChargeMode[];
export const eipSharedChargeModeOptions = ["By bandwidth", "Enhanced 95"] as const satisfies readonly EipChargeMode[];
export const eipTrafficUnitOptions = ["GB", "TB"] as const satisfies readonly EipTrafficUnit[];

export const eipDefaults = {
  type: "Dedicated EIP" as EipType,
  chargeMode: "By bandwidth" as EipChargeMode,
  bandwidthMbit: 1,
  durationMonths: 1,
  sharedBandwidthQuantity: 1,
  trafficGb: 0,
  trafficUnit: "GB" as EipTrafficUnit,
} as const;

export const eipPricingReference = {
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/eip.html",
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/eip",
  billingOverviewUrl: "https://support.huaweicloud.com/intl/en-us/price-eip/eip_billing_0005.html",
  enhanced95Url: "https://support.huaweicloud.com/intl/en-us/price-eip/eip_billing_0009.html",
  sharedBandwidthGuideUrl: "https://support.huaweicloud.com/intl/en-us/usermanual-eip/bandwidth_0003.html",
} as const;

export const eipSharedBandwidthMinimumMbit = 5;
export const eipSharedEnhanced95MinimumMbit = 300;

function roundEipAmount(value: number) {
  return Number(value.toFixed(5));
}

export function convertEipTrafficToGb(amount: number, unit: EipTrafficUnit) {
  return unit === "TB" ? amount * 1024 : amount;
}

export function estimateEipTieredTrafficCost(tiers: readonly EipTrafficTier[], trafficGb: number) {
  if (!Number.isFinite(trafficGb) || trafficGb <= 0 || tiers.length === 0) {
    return 0;
  }

  const sortedTiers = [...tiers].sort((left, right) => left.startGb - right.startGb);
  let remaining = trafficGb;
  let previousEnd = 0;
  let total = 0;

  for (const tier of sortedTiers) {
    if (remaining <= 0) {
      break;
    }

    const tierStart = Math.max(previousEnd, tier.startGb);
    const tierEnd = tier.upToGb == null ? Number.POSITIVE_INFINITY : Math.max(tierStart, tier.upToGb);
    const tierCapacity = tierEnd === Number.POSITIVE_INFINITY ? remaining : Math.max(0, tierEnd - tierStart);
    const consumed = Math.min(remaining, tierCapacity);

    if (consumed > 0) {
      total += consumed * tier.amountPerGb;
      remaining -= consumed;
    }

    previousEnd = tierEnd === Number.POSITIVE_INFINITY ? previousEnd : tierEnd;
  }

  if (remaining > 0) {
    const lastTier = sortedTiers.at(-1);
    if (!lastTier) {
      return 0;
    }
    total += remaining * lastTier.amountPerGb;
  }

  return roundEipAmount(total);
}

export function selectEipTrafficPackageCombination(
  packages: readonly EipTrafficPackage[],
  requiredGb: number,
): {
  amount: number;
  items: EipPackageSelectionItem[];
} | null {
  const normalizedTarget = Math.max(0, Math.ceil(requiredGb));
  if (normalizedTarget <= 0) {
    return { amount: 0, items: [] };
  }

  const normalizedPackages = [...packages]
    .filter((entry) => Number.isFinite(entry.sizeGb) && entry.sizeGb > 0 && Number.isFinite(entry.amount) && entry.amount > 0)
    .reduce<EipTrafficPackage[]>((accumulator, current) => {
      const existingIndex = accumulator.findIndex((entry) => entry.sizeGb === current.sizeGb);
      if (existingIndex === -1) {
        accumulator.push(current);
        return accumulator;
      }

      if (current.amount < accumulator[existingIndex].amount) {
        accumulator[existingIndex] = current;
      }
      return accumulator;
    }, [])
    .sort((left, right) => left.sizeGb - right.sizeGb);

  if (normalizedPackages.length === 0) {
    return null;
  }

  const largestPackage = normalizedPackages.at(-1)?.sizeGb ?? 0;
  const maxState = normalizedTarget + largestPackage;
  const dp = Array<number>(maxState + 1).fill(Number.POSITIVE_INFINITY);
  const choice = Array<number>(maxState + 1).fill(-1);
  dp[0] = 0;

  for (let remaining = 1; remaining <= maxState; remaining += 1) {
    for (let packageIndex = 0; packageIndex < normalizedPackages.length; packageIndex += 1) {
      const pkg = normalizedPackages[packageIndex];
      const previousRemaining = Math.max(0, remaining - pkg.sizeGb);
      const nextCost = dp[previousRemaining] + pkg.amount;
      if (nextCost < dp[remaining]) {
        dp[remaining] = nextCost;
        choice[remaining] = packageIndex;
      }
    }
  }

  if (!Number.isFinite(dp[normalizedTarget])) {
    return null;
  }

  const counts = new Map<number, EipPackageSelectionItem>();
  let remaining = normalizedTarget;
  while (remaining > 0) {
    const selectedIndex = choice[remaining];
    if (selectedIndex < 0) {
      return null;
    }

    const pkg = normalizedPackages[selectedIndex];
    const current = counts.get(pkg.sizeGb);
    counts.set(pkg.sizeGb, {
      sizeGb: pkg.sizeGb,
      count: (current?.count ?? 0) + 1,
      amount: roundEipAmount((current?.amount ?? 0) + pkg.amount),
    });
    remaining = Math.max(0, remaining - pkg.sizeGb);
  }

  return {
    amount: roundEipAmount(dp[normalizedTarget]),
    items: [...counts.values()].sort((left, right) => left.sizeGb - right.sizeGb),
  };
}

function estimateEnhanced95Cost(monthlyRatePerMbit: number, bandwidthMbit: number, durationMonths: number) {
  const normalizedBandwidth = Math.max(eipSharedEnhanced95MinimumMbit, bandwidthMbit);
  return roundEipAmount(normalizedBandwidth * monthlyRatePerMbit * Math.max(1, durationMonths));
}

export function estimateEipConfiguration(catalog: EipPricingCatalog, input: EipEstimateInput): EipEstimateResult | null {
  const notes: string[] = [];
  const durationHours = Math.max(1, input.durationHours);
  const durationMonths = Math.max(1, input.durationMonths);
  const breakdown: EipEstimateBreakdownItem[] = [];
  let suffix = "/mo";
  let eipCost = 0;
  let bandwidthCost = 0;
  let trafficCost = 0;
  let enhanced95Cost = 0;
  const packageSelection: EipPackageSelectionItem[] = [];

  if (input.type === "Dedicated EIP") {
    if (input.chargeMode === "By traffic" && input.billingMode !== "Pay-per-use") {
      return null;
    }

    if (input.billingMode === "Pay-per-use") {
      const eipRate = catalog.dedicated.eipRates.ONDEMAND;
      if (eipRate == null) {
        return null;
      }
      eipCost = eipRate * durationHours;
      suffix = `/${durationHours}h`;
    }

    if (input.chargeMode === "By bandwidth") {
      if (input.billingMode === "Pay-per-use") {
        const rate = catalog.dedicated.bandwidthRates.ONDEMAND;
        if (rate == null) {
          return null;
        }
        bandwidthCost = rate * Math.max(0, input.bandwidthMbit) * durationHours;
      } else {
        const rate = catalog.dedicated.bandwidthRates.MONTHLY
          ?? (catalog.dedicated.bandwidthRates.YEARLY != null ? catalog.dedicated.bandwidthRates.YEARLY / 12 : null);
        if (rate == null) {
          return null;
        }
        bandwidthCost = rate * Math.max(0, input.bandwidthMbit);
        suffix = "/mo";
      }
    } else {
      const rate = catalog.dedicated.trafficRatePerGb;
      if (rate == null) {
        return null;
      }
      trafficCost = rate * convertEipTrafficToGb(Math.max(0, input.trafficAmount), input.trafficUnit);
      notes.push("Dedicated pay-per-use traffic uses Huawei's live flat per-GB outbound traffic rate for the selected region.");
    }
  } else {
    if (input.billingMode !== "Pay-per-use") {
      return null;
    }

    const eipRate = catalog.dedicated.eipRates.ONDEMAND;
    if (eipRate == null) {
      return null;
    }
    eipCost = eipRate * durationHours;
    suffix = `/${durationHours}h`;

    if (input.chargeMode === "By bandwidth") {
      const rate = catalog.shared.bandwidthRates.ONDEMAND;
      if (rate == null) {
        return null;
      }
      bandwidthCost = rate * Math.max(eipSharedBandwidthMinimumMbit, input.bandwidthMbit) * Math.max(1, input.sharedBandwidthQuantity) * durationHours;
      notes.push("Shared bandwidth pricing is applied to the shared bandwidth resource. The EIP itself remains billed on a pay-per-use basis.");
    } else if (input.chargeMode === "Enhanced 95") {
      const monthlyRatePerMbit = catalog.shared.enhanced95MonthlyBaseRate;
      if (monthlyRatePerMbit == null) {
        return null;
      }
      eipCost = 0;
      enhanced95Cost = estimateEnhanced95Cost(monthlyRatePerMbit, input.bandwidthMbit, durationMonths);
      suffix = durationMonths === 1 ? "/mo" : `/${durationMonths}mo`;
      notes.push("Enhanced 95 pricing uses Huawei's live 95peak_plus monthly rate per Mbit/s and is settled by month.");
    } else {
      return null;
    }
  }

  const amount = roundEipAmount(eipCost + bandwidthCost + trafficCost + enhanced95Cost);
  const monthlyAverageAmount = input.type === "Shared EIP" && input.chargeMode === "Enhanced 95"
    ? roundEipAmount(amount / durationMonths)
    : input.billingMode === "Pay-per-use"
    ? roundEipAmount(amount / (durationHours / (24 * 30)))
    : amount;

  if (eipCost > 0) {
    breakdown.push({ key: "eip", label: "EIP duration", amount: roundEipAmount(eipCost) });
  }
  if (bandwidthCost > 0) {
    breakdown.push({ key: "bandwidth", label: input.type === "Shared EIP" ? "Shared bandwidth" : "Bandwidth", amount: roundEipAmount(bandwidthCost) });
  }
  if (trafficCost > 0) {
    breakdown.push({ key: "traffic", label: "Traffic", amount: roundEipAmount(trafficCost) });
  }
  if (enhanced95Cost > 0) {
    breakdown.push({ key: "enhanced95", label: "Enhanced 95", amount: roundEipAmount(enhanced95Cost) });
  }

  return {
    currency: catalog.currency,
    amount,
    suffix,
    monthlyAverageAmount,
    breakdown,
    notes,
    packageSelection,
  };
}
