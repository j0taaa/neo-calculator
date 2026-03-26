import { sendHttpRequest } from "@/lib/huawei-http";
import {
  type EipCatalogRateSet,
  type EipPricingCatalog,
  type EipTrafficPackage,
  type EipTrafficTier,
} from "@/lib/eip-catalog";

type RawPlan = {
  productId?: string;
  billingMode?: string;
  billingEvent?: string;
  periodNum?: number | null;
  amount?: number;
  usageFactor?: string;
  divisionList?: Array<{
    amount?: number;
    division?: {
      beginValue?: number;
      endValue?: number;
    };
  }>;
};

type RawEipItem = {
  resourceSpecCode?: string;
  planList?: RawPlan[];
  shareType?: string;
  eipType?: string;
};

const EIP_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildEipProductInfoUrl(regionId: string) {
  const url = new URL(EIP_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "eip");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function pickAmount(item: RawEipItem | undefined, billingMode: "ONDEMAND" | "MONTHLY" | "YEARLY") {
  return item?.planList?.find((plan) => plan.billingMode === billingMode && typeof plan.amount === "number")?.amount ?? null;
}

function buildRateSet(item: RawEipItem | undefined): EipCatalogRateSet {
  return {
    ONDEMAND: pickAmount(item, "ONDEMAND") ?? undefined,
    MONTHLY: pickAmount(item, "MONTHLY") ?? undefined,
    YEARLY: pickAmount(item, "YEARLY") ?? undefined,
  };
}

function buildTrafficRateTiers(item: RawEipItem | undefined): EipTrafficTier[] {
  const plan = item?.planList?.find((entry) => entry.billingMode === "ONDEMAND" && entry.billingEvent === "event.type.bandwidthupflow");
  return (plan?.divisionList ?? [])
    .map((tier) => {
      if (typeof tier.amount !== "number" || !Number.isFinite(tier.amount)) {
        return null;
      }

      return {
        startGb: typeof tier.division?.beginValue === "number" ? Math.max(0, tier.division.beginValue) : 0,
        upToGb: typeof tier.division?.endValue === "number" && tier.division.endValue >= 0 ? tier.division.endValue : null,
        amountPerGb: tier.amount,
      } satisfies EipTrafficTier;
    })
    .filter((entry): entry is EipTrafficTier => entry != null)
    .sort((left, right) => left.startGb - right.startGb);
}

function parsePackageSizeGb(resourceSpecCode: string | undefined) {
  const match = (resourceSpecCode ?? "").match(/_(\d+)GB$/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildTrafficPackages(items: RawEipItem[]) {
  const packages: Record<"MONTHLY" | "YEARLY", EipTrafficPackage[]> = {
    MONTHLY: [],
    YEARLY: [],
  };

  for (const item of items) {
    const sizeGb = parsePackageSizeGb(item.resourceSpecCode);
    if (sizeGb == null) {
      continue;
    }

    for (const plan of item.planList ?? []) {
      if ((plan.billingMode !== "MONTHLY" && plan.billingMode !== "YEARLY") || typeof plan.amount !== "number" || !Number.isFinite(plan.amount)) {
        continue;
      }

      packages[plan.billingMode].push({
        billingMode: plan.billingMode,
        sizeGb,
        amount: plan.amount,
        resourceSpecCode: item.resourceSpecCode ?? `${plan.billingMode}_${sizeGb}GB`,
        productId: typeof plan.productId === "string" ? plan.productId : null,
      });
    }
  }

  for (const billingMode of ["MONTHLY", "YEARLY"] as const) {
    packages[billingMode].sort((left, right) => left.sizeGb - right.sizeGb);
  }

  return packages;
}

function pickTrafficFlatRate(item: RawEipItem | undefined) {
  const plan = item?.planList?.find((entry) => entry.billingMode === "ONDEMAND" && entry.billingEvent === "event.type.bandwidthupflow");
  const divisionAmount = plan?.divisionList?.find((division) => typeof division.amount === "number" && Number.isFinite(division.amount))?.amount ?? null;
  return divisionAmount ?? null;
}

export async function fetchEipPricingCatalog(regionId: string): Promise<EipPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildEipProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`EIP product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("EIP product info response was empty");
  }

  let body: {
    product?: {
      vpc_ip?: RawEipItem[];
      vpc_bandwidth?: RawEipItem[];
    };
  };
  try {
    body = JSON.parse(response.bodyText) as {
      product?: {
        vpc_ip?: RawEipItem[];
        vpc_bandwidth?: RawEipItem[];
      };
    };
  } catch {
    throw new Error(`EIP product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  const eipItems = body.product?.vpc_ip ?? [];
  const bandwidthItems = body.product?.vpc_bandwidth ?? [];
  const dedicatedEipItem = eipItems.find((item) => item.resourceSpecCode === "5_bgp") ?? eipItems[0];
  const dedicatedBandwidthItem = bandwidthItems.find((item) => item.resourceSpecCode === "19_bgp" && item.shareType === "dataInfo_3_" && item.eipType === "dataInfo_5_")
    ?? bandwidthItems.find((item) => item.resourceSpecCode === "19_bgp");
  const sharedBandwidthItem = bandwidthItems.find((item) => item.resourceSpecCode === "19_share" && item.shareType === "dataInfo_4_" && item.eipType === "dataInfo_5_")
    ?? bandwidthItems.find((item) => item.resourceSpecCode === "19_share" && item.eipType === "dataInfo_5_");
  const sharedEnhanced95Item = bandwidthItems.find((item) => item.resourceSpecCode === "19_share" && item.shareType === "dataInfo_4_" && item.eipType === "dataInfo_17_");
  const dedicatedTrafficItem = bandwidthItems.find((item) => item.resourceSpecCode === "12_bgp" && item.shareType === "dataInfo_3_")
    ?? bandwidthItems.find((item) => item.resourceSpecCode === "12_bgp");
  const dedicatedTrafficPackageItems = bandwidthItems.filter((item) => (
    (item.resourceSpecCode ?? "").startsWith("12_bgp_")
    && item.shareType === "dataInfo_13_"
  ));

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    dedicated: {
      eipRates: buildRateSet(dedicatedEipItem),
      bandwidthRates: buildRateSet(dedicatedBandwidthItem),
      trafficRatePerGb: pickTrafficFlatRate(dedicatedTrafficItem),
      trafficRateTiers: buildTrafficRateTiers(dedicatedTrafficItem),
      trafficPackages: buildTrafficPackages(dedicatedTrafficPackageItems),
    },
    shared: {
      bandwidthRates: buildRateSet(sharedBandwidthItem),
      enhanced95MonthlyBaseRate: pickAmount(sharedEnhanced95Item, "ONDEMAND"),
    },
  };
}
