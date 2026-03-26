export type CceClusterScale = "50 nodes" | "200 nodes" | "1000 nodes" | "2000 nodes";
export type CceMasterNodes = "3 Masters" | "Single";
export type CceProductCategory = "CCE cluster" | "CCE Autopilot cluster";
export type CcePricingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

export interface CcePricingTier {
  scale: CceClusterScale;
  masterNodes: CceMasterNodes;
  resourceSpecCode: string;
  prices: Partial<Record<CcePricingMode, number>>;
  productIds: Partial<Record<CcePricingMode, string>>;
}

export interface CcePricingCatalog {
  currency: string;
  regionId: string;
  tiers: CcePricingTier[];
}

export interface CceEstimate {
  currency: string;
  amount: number;
  suffix: string;
  monthlyAmount: number | null;
  yearlyAmount: number | null;
  hourlyAmount: number | null;
  tier: CcePricingTier;
}

const DEFAULT_CURRENCY = "USD";
const DEFAULT_REGION = "ap-southeast-1";
const DEFAULT_SCALE: CceClusterScale = "50 nodes";
const DEFAULT_MASTER_NODES: CceMasterNodes = "3 Masters";

const clusterScaleCodeMap = {
  dataInfo_50_: "50 nodes",
  dataInfo_200_: "200 nodes",
  dataInfo_1000_: "1000 nodes",
  dataInfo_2000_: "2000 nodes",
} as const satisfies Record<string, CceClusterScale>;

// Huawei's productInfo payload does not expose human-readable master labels for CCE.
// This mapping is inferred from the live calculator options and the published price ratios.
const clusterMasterScaleCodeMap = {
  dataInfo_4_: "3 Masters",
  dataInfo_5_: "Single",
} as const satisfies Record<string, CceMasterNodes>;

const fallbackPricingCatalog: CcePricingCatalog = {
  currency: DEFAULT_CURRENCY,
  regionId: DEFAULT_REGION,
  tiers: [
    {
      scale: "50 nodes",
      masterNodes: "Single",
      resourceSpecCode: "cce.s1.small",
      prices: { ONDEMAND: 0.18, MONTHLY: 95.22, YEARLY: 952.2 },
      productIds: {
        ONDEMAND: "00301-20002-0--0",
        MONTHLY: "00301-20066-0--0",
        YEARLY: "00301-19060-0--0",
      },
    },
    {
      scale: "50 nodes",
      masterNodes: "3 Masters",
      resourceSpecCode: "cce.s2.small",
      prices: { ONDEMAND: 0.54, MONTHLY: 285.66, YEARLY: 2856.6 },
      productIds: {
        ONDEMAND: "00301-19003-0--0",
        MONTHLY: "00301-20068-0--0",
        YEARLY: "00301-19064-0--0",
      },
    },
    {
      scale: "200 nodes",
      masterNodes: "Single",
      resourceSpecCode: "cce.s1.medium",
      prices: { ONDEMAND: 0.35, MONTHLY: 183.82, YEARLY: 1838.2 },
      productIds: {
        ONDEMAND: "00301-19002-0--0",
        MONTHLY: "00301-19061-0--0",
        YEARLY: "00301-19062-0--0",
      },
    },
    {
      scale: "200 nodes",
      masterNodes: "3 Masters",
      resourceSpecCode: "cce.s2.medium",
      prices: { ONDEMAND: 1.05, MONTHLY: 551.46, YEARLY: 5514.6 },
      productIds: {
        ONDEMAND: "00301-20004-0--0",
        MONTHLY: "00301-20069-0--0",
        YEARLY: "00301-19065-0--0",
      },
    },
    {
      scale: "1000 nodes",
      masterNodes: "Single",
      resourceSpecCode: "cce.s1.large",
      prices: { ONDEMAND: 0.7, MONTHLY: 359.82, YEARLY: 3598.2 },
      productIds: {
        ONDEMAND: "00301-20003-0--0",
        MONTHLY: "00301-20067-0--0",
        YEARLY: "00301-19063-0--0",
      },
    },
    {
      scale: "1000 nodes",
      masterNodes: "3 Masters",
      resourceSpecCode: "cce.s2.large",
      prices: { ONDEMAND: 2.1, MONTHLY: 1079.46, YEARLY: 10794.6 },
      productIds: {
        ONDEMAND: "00301-19004-0--0",
        MONTHLY: "00301-20070-0--0",
        YEARLY: "00301-19066-0--0",
      },
    },
    {
      scale: "2000 nodes",
      masterNodes: "Single",
      resourceSpecCode: "cce.s1.xlarge",
      prices: { ONDEMAND: 1.47, MONTHLY: 791.25, YEARLY: 7912.5 },
      productIds: {
        ONDEMAND: "OFFI822024255673266176",
        MONTHLY: "OFFI822024255677460480",
        YEARLY: "OFFI822024255677460482",
      },
    },
    {
      scale: "2000 nodes",
      masterNodes: "3 Masters",
      resourceSpecCode: "cce.s2.xlarge",
      prices: { ONDEMAND: 4.4, MONTHLY: 2373.75, YEARLY: 23737.5 },
      productIds: {
        ONDEMAND: "OFFI822024255677460483",
        MONTHLY: "OFFI822024255677460481",
        YEARLY: "OFFI822024255677460484",
      },
    },
  ],
};

export function getFallbackCcePricingCatalog(): CcePricingCatalog {
  return fallbackPricingCatalog;
}

export function listCceClusterScales(catalog: CcePricingCatalog = fallbackPricingCatalog): CceClusterScale[] {
  const values = new Set<CceClusterScale>();

  for (const tier of catalog.tiers) {
    values.add(tier.scale);
  }

  return (Object.values(clusterScaleCodeMap) as CceClusterScale[]).filter((scale) => values.has(scale));
}

export function listCceMasterNodes(
  scale?: CceClusterScale,
  catalog: CcePricingCatalog = fallbackPricingCatalog,
): CceMasterNodes[] {
  const values = new Set<CceMasterNodes>();

  for (const tier of catalog.tiers) {
    if (!scale || tier.scale === scale) {
      values.add(tier.masterNodes);
    }
  }

  return (Object.values(clusterMasterScaleCodeMap) as CceMasterNodes[]).filter((masterNodes) => values.has(masterNodes));
}

export function getCcePrice(
  scale: CceClusterScale,
  masterNodes: CceMasterNodes,
  catalog: CcePricingCatalog = fallbackPricingCatalog,
): CcePricingTier | null {
  return catalog.tiers.find((tier) => tier.scale === scale && tier.masterNodes === masterNodes) ?? null;
}

export function estimateCceConfiguration(
  catalog: CcePricingCatalog,
  input: {
    scale: CceClusterScale;
    masterNodes: CceMasterNodes;
    billingMode: "Pay-per-use" | "Yearly/Monthly";
    usageHours?: number | null;
  },
): CceEstimate | null {
  const tier = getCcePrice(input.scale, input.masterNodes, catalog);
  if (!tier) {
    return null;
  }

  const hourlyAmount = tier.prices.ONDEMAND ?? null;
  const monthlyAmount = tier.prices.MONTHLY ?? null;
  const yearlyAmount = tier.prices.YEARLY ?? null;

  if (input.billingMode === "Pay-per-use") {
    if (hourlyAmount == null) {
      return null;
    }

    const hours = typeof input.usageHours === "number" && Number.isFinite(input.usageHours) ? Math.max(1, input.usageHours) : 1;

    return {
      currency: catalog.currency,
      amount: hourlyAmount * hours,
      suffix: "/h",
      monthlyAmount,
      yearlyAmount,
      hourlyAmount,
      tier,
    };
  }

  if (monthlyAmount == null) {
    return null;
  }

  return {
    currency: catalog.currency,
    amount: monthlyAmount,
    suffix: "/mo",
    monthlyAmount,
    yearlyAmount,
    hourlyAmount,
    tier,
  };
}

export const ccePricingReference = {
  productUrl: "https://www.huaweicloud.com/intl/en-us/product/cce.html",
  pricingUrl: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html#/cce",
  calculatorApi: "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo",
};

export const cceDefaults = {
  scale: DEFAULT_SCALE,
  masterNodes: DEFAULT_MASTER_NODES,
  productCategory: "CCE cluster" as CceProductCategory,
  clusterType: "Standard/Turbo",
  durationHours: 1,
};
