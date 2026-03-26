import { sendHttpRequest } from "@/lib/huawei-http";
import { type CceClusterScale, type CceMasterNodes, type CcePricingCatalog, type CcePricingMode, type CcePricingTier } from "@/lib/cce-catalog";

type RawPlan = {
  productId?: string;
  billingMode?: string;
  amount?: number;
};

type RawCceClusterItem = {
  resourceSpecCode?: string;
  clusterType?: string;
  clusterNodeScale?: string;
  clusterMasterScale?: string;
  planList?: RawPlan[];
};

const CCE_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

const clusterScaleCodeMap = {
  dataInfo_50_: "50 nodes",
  dataInfo_200_: "200 nodes",
  dataInfo_1000_: "1000 nodes",
  dataInfo_2000_: "2000 nodes",
} as const satisfies Record<string, CceClusterScale>;

// Huawei's CCE productInfo response omits the human-readable labels for this selector.
const clusterMasterScaleCodeMap = {
  dataInfo_4_: "3 Masters",
  dataInfo_5_: "Single",
} as const satisfies Record<string, CceMasterNodes>;

function buildCceProductInfoUrl(regionId: string) {
  const url = new URL(CCE_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "cce");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function normalizePricingMode(value: string | undefined): CcePricingMode | null {
  if (value === "ONDEMAND" || value === "MONTHLY" || value === "YEARLY") {
    return value;
  }

  return null;
}

function parseCceTier(item: RawCceClusterItem): CcePricingTier | null {
  if (item.clusterType !== "dataInfo_2_") {
    return null;
  }

  const scale = item.clusterNodeScale ? clusterScaleCodeMap[item.clusterNodeScale as keyof typeof clusterScaleCodeMap] : null;
  const masterNodes = item.clusterMasterScale
    ? clusterMasterScaleCodeMap[item.clusterMasterScale as keyof typeof clusterMasterScaleCodeMap]
    : null;

  if (!scale || !masterNodes || typeof item.resourceSpecCode !== "string") {
    return null;
  }

  const prices: Partial<Record<CcePricingMode, number>> = {};
  const productIds: Partial<Record<CcePricingMode, string>> = {};

  for (const plan of item.planList ?? []) {
    const mode = normalizePricingMode(plan.billingMode);
    if (!mode || typeof plan.amount !== "number" || !Number.isFinite(plan.amount)) {
      continue;
    }

    prices[mode] = plan.amount;
    if (typeof plan.productId === "string" && plan.productId) {
      productIds[mode] = plan.productId;
    }
  }

  return {
    scale,
    masterNodes,
    resourceSpecCode: item.resourceSpecCode,
    prices,
    productIds,
  };
}

export async function fetchCcePricingCatalog(regionId: string): Promise<CcePricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildCceProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`CCE product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("CCE product info response was empty");
  }

  let body: { product?: { "cce_cce.cluster"?: RawCceClusterItem[] } };
  try {
    body = JSON.parse(response.bodyText) as { product?: { "cce_cce.cluster"?: RawCceClusterItem[] } };
  } catch {
    throw new Error(`CCE product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  const tiers = (Array.isArray(body.product?.["cce_cce.cluster"]) ? body.product["cce_cce.cluster"] : [])
    .map(parseCceTier)
    .filter((tier): tier is CcePricingTier => tier != null)
    .sort((left, right) => {
      const scaleDifference =
        (Object.values(clusterScaleCodeMap) as CceClusterScale[]).indexOf(left.scale)
        - (Object.values(clusterScaleCodeMap) as CceClusterScale[]).indexOf(right.scale);
      if (scaleDifference !== 0) {
        return scaleDifference;
      }

      return (Object.values(clusterMasterScaleCodeMap) as CceMasterNodes[]).indexOf(left.masterNodes)
        - (Object.values(clusterMasterScaleCodeMap) as CceMasterNodes[]).indexOf(right.masterNodes);
    });

  if (tiers.length === 0) {
    throw new Error("CCE product info response did not include any supported cluster tiers");
  }

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    tiers,
  };
}
