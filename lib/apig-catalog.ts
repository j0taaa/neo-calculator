import type { RegionalPricingCatalog } from "@/lib/pricing-catalog-types";

export type ApigEdition =
  | "Basic"
  | "Professional"
  | "Enterprise"
  | "Platinum"
  | "Platinum 2"
  | "Platinum 3"
  | "Platinum 4"
  | "Platinum 5"
  | "Platinum 6"
  | "Platinum 7"
  | "Platinum 8";

export interface ApigEditionTier {
  edition: ApigEdition;
  resourceSpecCode: string;
  hourlyRate: number | null;
  productId: string | null;
}

export interface ApigPublicBandwidthTier {
  resourceSpecCode: string;
  productId: string | null;
  ratePerMbitHour: number | null;
  tiers: Array<{
    startGb: number;
    upToGb: number | null;
    amountPerGb: number;
  }>;
}

export interface ApigPricingCatalog extends RegionalPricingCatalog {
  editionTiers: ApigEditionTier[];
  publicBandwidthTiers: ApigPublicBandwidthTier[];
}

export interface ApigEstimateInput {
  edition: ApigEdition;
  publicOutboundAccess: boolean;
  bandwidthMbit: number;
  usageHours: number;
  quantity: number;
}

export interface ApigEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAverageAmount: number;
  edition: ApigEdition;
  publicOutboundAccess: boolean;
  bandwidthMbit: number;
  usageHours: number;
  quantity: number;
  tier: ApigEditionTier;
  publicBandwidthTier: ApigPublicBandwidthTier | null;
  breakdown: Array<{ label: string; amount: number }>;
  notes: string[];
}

export const apigDefaults = {
  edition: "Basic" as ApigEdition,
  publicOutboundAccess: false,
  bandwidthMbit: 1,
  usageHours: 744,
  quantity: 1,
} as const;

export const apigPricingReference = {
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/apig",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/apig.html",
} as const;

const editionOrder: ApigEdition[] = [
  "Basic",
  "Professional",
  "Enterprise",
  "Platinum",
  "Platinum 2",
  "Platinum 3",
  "Platinum 4",
  "Platinum 5",
  "Platinum 6",
  "Platinum 7",
  "Platinum 8",
];

function roundAmount(value: number) {
  return Number(value.toFixed(5));
}

function estimateTieredBandwidthCost(tiers: readonly ApigPublicBandwidthTier["tiers"][number][], bandwidthMbit: number) {
  if (!Number.isFinite(bandwidthMbit) || bandwidthMbit <= 0 || tiers.length === 0) {
    return 0;
  }

  let total = 0;
  let remaining = bandwidthMbit;
  for (const tier of [...tiers].sort((left, right) => left.startGb - right.startGb)) {
    if (remaining <= 0) {
      break;
    }
    const tierStart = Math.max(0, tier.startGb);
    const tierEnd = tier.upToGb == null ? Number.POSITIVE_INFINITY : Math.max(tierStart, tier.upToGb);
    const capacity = tierEnd === Number.POSITIVE_INFINITY ? remaining : Math.max(0, tierEnd - tierStart);
    const consumed = Math.min(remaining, capacity);
    if (consumed > 0) {
      total += consumed * tier.amountPerGb;
      remaining -= consumed;
    }
  }
  if (remaining > 0) {
    const lastTier = tiers.at(-1);
    if (lastTier) {
      total += remaining * lastTier.amountPerGb;
    }
  }
  return roundAmount(total);
}

function estimatePublicBandwidthCost(tier: ApigPublicBandwidthTier, bandwidthMbit: number) {
  if (tier.tiers.length > 0) {
    return estimateTieredBandwidthCost(tier.tiers, bandwidthMbit);
  }
  if (tier.ratePerMbitHour != null && Number.isFinite(tier.ratePerMbitHour) && tier.ratePerMbitHour > 0) {
    return roundAmount(tier.ratePerMbitHour * bandwidthMbit);
  }
  return 0;
}

export function listApigEditions(catalog: ApigPricingCatalog) {
  const values = new Set<ApigEdition>();
  for (const tier of catalog.editionTiers) {
    if (tier.hourlyRate != null) {
      values.add(tier.edition);
    }
  }
  return editionOrder.filter((edition) => values.has(edition));
}

export function findApigEditionTier(catalog: ApigPricingCatalog, edition: ApigEdition) {
  return catalog.editionTiers.find((tier) => tier.edition === edition) ?? null;
}

function getPrimaryPublicBandwidthTier(catalog: ApigPricingCatalog) {
  return catalog.publicBandwidthTiers.find((tier) => tier.tiers.length > 0 || (tier.ratePerMbitHour != null && tier.ratePerMbitHour > 0)) ?? null;
}

export function estimateApigConfiguration(catalog: ApigPricingCatalog, input: ApigEstimateInput): ApigEstimate | null {
  const tier = findApigEditionTier(catalog, input.edition);
  if (!tier || tier.hourlyRate == null) {
    return null;
  }
  if (!Number.isFinite(input.usageHours) || input.usageHours < 1) {
    return null;
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return null;
  }
  if (input.publicOutboundAccess && (!Number.isFinite(input.bandwidthMbit) || input.bandwidthMbit < 1)) {
    return null;
  }
  if (!input.publicOutboundAccess && (!Number.isFinite(input.bandwidthMbit) || input.bandwidthMbit < 0)) {
    return null;
  }

  const usageHours = Math.floor(input.usageHours);
  const quantity = Math.floor(input.quantity);
  const bandwidthMbit = input.publicOutboundAccess ? roundAmount(input.bandwidthMbit) : 0;
  const instanceAmount = roundAmount(tier.hourlyRate * usageHours * quantity);
  const publicBandwidthTier = input.publicOutboundAccess ? getPrimaryPublicBandwidthTier(catalog) : null;
  if (input.publicOutboundAccess && !publicBandwidthTier) {
    return null;
  }
  const publicBandwidthRatePerHour = publicBandwidthTier ? estimatePublicBandwidthCost(publicBandwidthTier, bandwidthMbit) : 0;
  const publicBandwidthAmount = roundAmount(publicBandwidthRatePerHour * usageHours * quantity);
  const amount = roundAmount(instanceAmount + publicBandwidthAmount);
  const monthlyAverageAmount = roundAmount(amount / (usageHours / (24 * 30)));

  return {
    currency: catalog.currency,
    amount,
    suffix: `/${usageHours}h`,
    monthlyAverageAmount,
    edition: input.edition,
    publicOutboundAccess: input.publicOutboundAccess,
    bandwidthMbit,
    usageHours,
    quantity,
    tier,
    publicBandwidthTier,
    breakdown: [
      {
        label: `${quantity} x ${input.edition} for ${usageHours}h`,
        amount: instanceAmount,
      },
      ...(input.publicOutboundAccess
        ? [{
            label: `${quantity} x public outbound ${bandwidthMbit} Mbit/s for ${usageHours}h`,
            amount: publicBandwidthAmount,
          }]
        : []),
    ],
    notes: [
      `Instance rate: ${catalog.currency} ${tier.hourlyRate.toFixed(6)}/gateway/h.`,
      input.publicOutboundAccess && publicBandwidthTier
        ? publicBandwidthTier.tiers.length > 0
          ? "Public outbound access uses the tiered APIG bandwidth rate from the live Huawei calculator catalog."
          : `Public outbound access uses the direct APIG bandwidth rate: ${catalog.currency} ${publicBandwidthTier.ratePerMbitHour?.toFixed(6) ?? "0.000000"}/Mbit/s/h.`
        : "Public outbound access is disabled.",
    ],
  };
}
