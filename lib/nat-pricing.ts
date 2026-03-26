import { sendHttpRequest } from "@/lib/huawei-http";
import {
  type NatGatewaySize,
  type NatGatewayType,
  type NatPricingCatalog,
  type NatPricingTier,
} from "@/lib/nat-catalog";

type RawPlan = {
  billingMode?: string;
  billingEvent?: string;
  periodNum?: number | null;
  amount?: number;
};

type RawNatItem = {
  resourceSpecCode?: string;
  planList?: RawPlan[];
};

const NAT_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildNatProductInfoUrl(regionId: string) {
  const url = new URL(NAT_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "nat");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function mapNatSize(resourceSpecCode: string | undefined): NatGatewaySize | null {
  const normalized = (resourceSpecCode ?? "").toLowerCase();
  if (normalized.includes("small")) {
    return "Small";
  }
  if (normalized.includes("middle") || normalized.includes("medium")) {
    return "Medium";
  }
  if (normalized.includes("xlarge")) {
    return "Extra-large";
  }
  if (normalized.includes("large")) {
    return "Large";
  }
  return null;
}

function pickAmount(item: RawNatItem | undefined, billingMode: "ONDEMAND" | "MONTHLY" | "YEARLY") {
  return item?.planList?.find((plan) => plan.billingMode === billingMode && typeof plan.amount === "number")?.amount ?? null;
}

function buildTier(type: NatGatewayType, item: RawNatItem): NatPricingTier | null {
  const size = mapNatSize(item.resourceSpecCode);
  if (!size) {
    return null;
  }

  return {
    type,
    size,
    resourceSpecCode: item.resourceSpecCode ?? `${type}-${size}`,
    prices: {
      ONDEMAND: pickAmount(item, "ONDEMAND") ?? undefined,
      MONTHLY: pickAmount(item, "MONTHLY") ?? undefined,
      YEARLY: pickAmount(item, "YEARLY") ?? undefined,
    },
  };
}

export async function fetchNatPricingCatalog(regionId: string): Promise<NatPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildNatProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`NAT product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("NAT product info response was empty");
  }

  let body: {
    product?: {
      natgateway_natgateway?: RawNatItem[];
      natgateway_privatenat?: RawNatItem[];
    };
  };
  try {
    body = JSON.parse(response.bodyText) as {
      product?: {
        natgateway_natgateway?: RawNatItem[];
        natgateway_privatenat?: RawNatItem[];
      };
    };
  } catch {
    throw new Error(`NAT product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  const publicTiers = (body.product?.natgateway_natgateway ?? [])
    .map((item) => buildTier("Public NAT Gateway", item))
    .filter((item): item is NatPricingTier => item != null);
  const privateTiers = (body.product?.natgateway_privatenat ?? [])
    .map((item) => buildTier("Private NAT Gateway", item))
    .filter((item): item is NatPricingTier => item != null);

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    tiers: [...publicTiers, ...privateTiers],
  };
}
