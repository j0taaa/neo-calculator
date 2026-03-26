import { sendHttpRequest } from "@/lib/huawei-http";
import {
  type ElbDedicatedProtocol,
  type ElbPricingCatalog,
  type ElbRateSet,
  type ElbSubAz,
} from "@/lib/elb-catalog";

type RawPlan = {
  billingMode?: string;
  amount?: number;
  billingEvent?: string;
};

type RawSharedItem = {
  elbType?: string;
  elbV2Type?: string;
  planList?: RawPlan[];
};

type RawDedicatedItem = {
  azType?: string;
  flavorCatagory?: string;
  flavorType?: string;
  resourceSpecCode?: string;
  productSpecSysDesc?: string;
  planList?: RawPlan[];
};

type RawBandwidthItem = {
  resourceSpecCode?: string;
  planList?: RawPlan[];
};

const ELB_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildElbProductInfoUrl(regionId: string) {
  const url = new URL(ELB_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "elb");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function pickAmount(item: { planList?: RawPlan[] }, billingMode: "ONDEMAND" | "MONTHLY" | "YEARLY") {
  return item.planList?.find((plan) => plan.billingMode === billingMode && typeof plan.amount === "number")?.amount ?? null;
}

function pickDivisionAmount(item: { planList?: RawPlan[] }, billingEvent: string) {
  const plan = item.planList?.find((entry) => entry.billingEvent === billingEvent);
  const divisionList = plan && "divisionList" in plan ? (plan as RawPlan & { divisionList?: Array<{ amount?: number }> }).divisionList : undefined;
  const amount = divisionList?.find((division) => typeof division.amount === "number" && division.amount > 0)?.amount;
  return amount ?? null;
}

function mapSubAz(code: string | undefined): ElbSubAz | null {
  if (code === "calc_65_") {
    return "Edge AZ";
  }

  if (code === "calc_64_" || code === "calc_67_") {
    return "General AZ";
  }

  return null;
}

function mapLoadBalancingType(flavorType: string | undefined): ElbDedicatedProtocol | null {
  if (flavorType === "calc_38_") {
    return "Network load balancing (TCP)";
  }

  if (flavorType === "calc_69_" || flavorType === "calc_70_" || flavorType === "calc_71_") {
    return "Network load balancing (TCP)";
  }
  if (flavorType === "calc_39_") {
    return "Application load balancing (HTTP/HTTPS)";
  }

  return null;
}

function parseFixedAzCount(item: RawDedicatedItem) {
  const resourceSpecCode = item.resourceSpecCode ?? "";
  const resourceMatch = resourceSpecCode.match(/\.([1-9]\d*)az$/);
  if (resourceMatch) {
    return Number(resourceMatch[1]);
  }

  const descMatch = (item.productSpecSysDesc ?? "").match(/AZ:(\d+)number/);
  if (descMatch) {
    return Number(descMatch[1]);
  }

  return null;
}

function buildSharedRates(item: RawSharedItem | undefined): ElbRateSet {
  if (!item) {
    return {};
  }

  return {
    ONDEMAND: pickAmount(item, "ONDEMAND") ?? undefined,
    MONTHLY: pickAmount(item, "MONTHLY") ?? undefined,
    YEARLY: pickAmount(item, "YEARLY") ?? undefined,
  };
}

export async function fetchElbPricingCatalog(regionId: string): Promise<ElbPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildElbProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`ELB product info request failed: ${response.status} ${response.statusText}`);
  }

  let body: {
    product?: {
      elb_elbv2?: RawSharedItem[];
      elb_elbv3?: RawDedicatedItem[];
      vpc_bandwidth?: RawBandwidthItem[];
    };
  };
  try {
    body = JSON.parse(response.bodyText) as {
      product?: {
        elb_elbv2?: RawSharedItem[];
        elb_elbv3?: RawDedicatedItem[];
        vpc_bandwidth?: RawBandwidthItem[];
      };
    };
  } catch {
    throw new Error(`ELB product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  const sharedItem = (body.product?.elb_elbv2 ?? []).find((item) => item.elbType === "dataInfo_2_" && item.elbV2Type === "detail_64_");
  const dedicatedItems = body.product?.elb_elbv3 ?? [];
  const bandwidthItems = body.product?.vpc_bandwidth ?? [];

  const fixed: ElbPricingCatalog["dedicatedRates"]["fixed"] = {};
  const elastic: ElbPricingCatalog["dedicatedRates"]["elastic"] = {};

  for (const item of dedicatedItems) {
    const subAz = mapSubAz(item.azType);
    const loadBalancingType = mapLoadBalancingType(item.flavorType);
    if (!subAz || !loadBalancingType) {
      continue;
    }

    const hourlyAmount = pickAmount(item, "ONDEMAND");
    if (hourlyAmount == null) {
      continue;
    }

    if (item.flavorCatagory === "calc_42_") {
      const fixedAzCount = parseFixedAzCount(item);
      const currentByAz = fixed[subAz] ?? {};
      const currentRateSet = fixedAzCount != null ? (currentByAz[fixedAzCount] ?? {}) : {};
      if (hourlyAmount > 0 && fixedAzCount != null && fixedAzCount > 0) {
        currentRateSet[loadBalancingType] = currentRateSet[loadBalancingType] == null
          ? hourlyAmount
          : Math.min(currentRateSet[loadBalancingType] ?? hourlyAmount, hourlyAmount);
        currentByAz[fixedAzCount] = currentRateSet;
      }
      fixed[subAz] = currentByAz;
      continue;
    }

    if (item.flavorCatagory === "calc_43_") {
      const current = elastic[subAz] ?? { basePerHour: null, lcuRates: {} };
      if (item.planList?.some((plan) => plan.billingEvent === "event.type.elb.elbv3.instance_duration")) {
        if (hourlyAmount > 0) {
          current.basePerHour = current.basePerHour == null ? hourlyAmount : Math.min(current.basePerHour, hourlyAmount);
        }
      } else if (hourlyAmount > 0) {
        current.lcuRates[loadBalancingType] = current.lcuRates[loadBalancingType] == null
          ? hourlyAmount
          : Math.min(current.lcuRates[loadBalancingType] ?? hourlyAmount, hourlyAmount);
      }
      if (current.basePerHour != null || Object.keys(current.lcuRates).length > 0) {
        elastic[subAz] = current;
      }
    }
  }

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    sharedRates: buildSharedRates(sharedItem),
    dedicatedRates: {
      fixed,
      elastic,
    },
    publicNetworkRates: {
      bandwidthPerMbitHour: pickAmount(bandwidthItems.find((item) => item.resourceSpecCode === "19_share") ?? {}, "ONDEMAND"),
      trafficPerGb: pickDivisionAmount(bandwidthItems.find((item) => item.resourceSpecCode === "12_share") ?? {}, "event.type.bandwidthupflow")
        ?? pickDivisionAmount(bandwidthItems.find((item) => item.resourceSpecCode === "12_bgp") ?? {}, "event.type.bandwidthupflow"),
    },
  };
}
