export type DiskBillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY";

export const systemDiskCodeMap = {
  "High I/O": "SAS",
  "Ultra-high I/O": "SSD",
  "Extreme SSD": "ESSD",
  "General Purpose SSD": "GPSSD",
  "General Purpose SSD V2": "GPSSD2.storage",
} as const;

export type SystemDiskOption = keyof typeof systemDiskCodeMap;

type DiskPlan = {
  billingMode?: string;
  amount?: number;
};

type RawDisk = {
  resourceSpecCode?: string;
  planList?: DiskPlan[];
  bakPlanList?: DiskPlan[];
};

type DiskPricingResponse = {
  currency: string;
  prices: Record<SystemDiskOption, Partial<Record<DiskBillingMode, number>>>;
};

const EVS_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

const systemDiskOptions = Object.keys(systemDiskCodeMap) as SystemDiskOption[];

function buildProductInfoUrl(regionId: string) {
  const url = new URL(EVS_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "evs");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "detail");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function pickRate(disk: RawDisk, billingMode: DiskBillingMode): number | null {
  const plans = [...(disk.planList ?? []), ...(disk.bakPlanList ?? [])];
  const amounts = plans
    .filter((plan) => plan.billingMode === billingMode && typeof plan.amount === "number" && Number.isFinite(plan.amount))
    .map((plan) => plan.amount as number);

  if (!amounts.length) {
    return null;
  }

  return Math.min(...amounts);
}

export async function fetchRegionSystemDiskPricing(regionId: string): Promise<DiskPricingResponse> {
  const response = await fetch(buildProductInfoUrl(regionId), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`EVS product info request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    product?: {
      ebs_volume?: RawDisk[];
    };
  };

  const disks = Array.isArray(body.product?.ebs_volume) ? body.product.ebs_volume : [];
  const prices = Object.fromEntries(
    systemDiskOptions.map((option) => {
      const disk = disks.find((candidate) => candidate.resourceSpecCode === systemDiskCodeMap[option]);
      return [
        option,
        {
          ONDEMAND: disk ? pickRate(disk, "ONDEMAND") ?? undefined : undefined,
          MONTHLY: disk ? pickRate(disk, "MONTHLY") ?? undefined : undefined,
          YEARLY: disk ? pickRate(disk, "YEARLY") ?? undefined : undefined,
        },
      ];
    }),
  ) as Record<SystemDiskOption, Partial<Record<DiskBillingMode, number>>>;

  return {
    currency: DEFAULT_CURRENCY,
    prices,
  };
}
