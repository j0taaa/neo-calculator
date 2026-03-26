import { sendHttpRequest } from "@/lib/huawei-http";
import {
  type VpnBandwidthAllocation,
  type VpnBandwidthPlan,
  type VpnBandwidthTier,
  type VpnDivisionRate,
  type VpnGatewayPlan,
  type VpnGatewayTier,
  type VpnMode,
  type VpnPricingCatalog,
  type VpnSpecification,
} from "@/lib/vpn-catalog";

type RawDivision = {
  amount?: number;
  division?: {
    beginValue?: number;
    endValue?: number;
  };
};

type RawPlan = {
  billingMode?: string;
  periodNum?: number | null;
  amount?: number;
  divisionList?: RawDivision[];
};

type RawGatewayItem = {
  resourceSpecCode?: string;
  planList?: RawPlan[];
};

type RawBandwidthItem = {
  resourceSpecCode?: string;
  planList?: RawPlan[];
};

const VPN_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildVpnProductInfoUrl(regionId: string) {
  const url = new URL(VPN_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "vpn");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function mapGatewayMeta(resourceSpecCode: string | undefined): {
  mode: VpnMode;
  specification: VpnSpecification;
  accessViaNonFixedIp: "Off" | "On";
} | null {
  const normalized = resourceSpecCode ?? "";
  if (normalized.includes("P2C")) {
    return {
      mode: "Point-to-Cloud",
      specification: "Professional 1",
      accessViaNonFixedIp: "Off",
    };
  }

  if (normalized.includes("NonFixedIP")) {
    return {
      mode: "Site-to-Cloud",
      specification: "Professional 2",
      accessViaNonFixedIp: "On",
    };
  }

  if (normalized === "V1G") {
    return {
      mode: "Site-to-Cloud",
      specification: "Professional 2",
      accessViaNonFixedIp: "Off",
    };
  }

  if (normalized === "vpn.s1") {
    return {
      mode: "Site-to-Cloud",
      specification: "Basic",
      accessViaNonFixedIp: "Off",
    };
  }

  if (normalized) {
    return {
      mode: "Site-to-Cloud",
      specification: "Professional 2",
      accessViaNonFixedIp: "Off",
    };
  }

  return null;
}

function buildDivisionRates(plan: RawPlan): VpnDivisionRate[] {
  if (plan.divisionList && plan.divisionList.length > 0) {
    return plan.divisionList
      .map((tier) => {
        if (typeof tier.amount !== "number" || !Number.isFinite(tier.amount)) {
          return null;
        }

        const start = typeof tier.division?.beginValue === "number" ? Math.max(0, tier.division.beginValue) : 0;
        const rawEnd = typeof tier.division?.endValue === "number" ? tier.division.endValue : null;
        const end = rawEnd == null || rawEnd < 0 ? null : Math.max(start, rawEnd);

        return {
          start,
          end,
          amount: tier.amount,
        } satisfies VpnDivisionRate;
      })
      .filter((entry): entry is VpnDivisionRate => entry != null)
      .sort((left, right) => left.start - right.start);
  }

  if (typeof plan.amount === "number" && Number.isFinite(plan.amount)) {
    return [{ start: 0, end: null, amount: plan.amount }];
  }

  return [];
}

function buildGatewayPlans(item: RawGatewayItem): VpnGatewayPlan[] {
  return (item.planList ?? [])
    .map((plan) => {
      if ((plan.billingMode !== "ONDEMAND" && plan.billingMode !== "MONTHLY" && plan.billingMode !== "YEARLY")) {
        return null;
      }

      const tiers = buildDivisionRates(plan);
      if (tiers.length === 0) {
        return null;
      }

      return {
        billingMode: plan.billingMode,
        periodNum: typeof plan.periodNum === "number" ? plan.periodNum : null,
        tiers,
      } satisfies VpnGatewayPlan;
    })
    .filter((entry): entry is VpnGatewayPlan => entry != null);
}

function buildBandwidthPlans(item: RawBandwidthItem): VpnBandwidthPlan[] {
  return (item.planList ?? [])
    .map((plan) => {
      if ((plan.billingMode !== "ONDEMAND" && plan.billingMode !== "MONTHLY" && plan.billingMode !== "YEARLY") || typeof plan.amount !== "number" || !Number.isFinite(plan.amount)) {
        return null;
      }

      return {
        billingMode: plan.billingMode,
        periodNum: typeof plan.periodNum === "number" ? plan.periodNum : null,
        amount: plan.amount,
      } satisfies VpnBandwidthPlan;
    })
    .filter((entry): entry is VpnBandwidthPlan => entry != null);
}

function buildGatewayTier(item: RawGatewayItem): VpnGatewayTier | null {
  const meta = mapGatewayMeta(item.resourceSpecCode);
  if (!meta) {
    return null;
  }

  const plans = buildGatewayPlans(item);
  if (plans.length === 0) {
    return null;
  }

  return {
    ...meta,
    resourceSpecCode: item.resourceSpecCode ?? `${meta.mode}-${meta.specification}`,
    plans,
  };
}

function buildBandwidthTier(allocation: VpnBandwidthAllocation, item: RawBandwidthItem): VpnBandwidthTier | null {
  const plans = buildBandwidthPlans(item);
  if (plans.length === 0) {
    return null;
  }

  return {
    allocation,
    resourceSpecCode: item.resourceSpecCode ?? allocation,
    plans,
  };
}

export async function fetchVpnPricingCatalog(regionId: string): Promise<VpnPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildVpnProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`VPN product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("VPN product info response was empty");
  }

  let body: {
    product?: {
      "vpn_vpn.ipsecvpn"?: RawGatewayItem[];
      "vpn_vpnconnection"?: RawGatewayItem[];
      vpc_bandwidth?: RawBandwidthItem[];
    };
  };
  try {
    body = JSON.parse(response.bodyText) as {
      product?: {
        "vpn_vpn.ipsecvpn"?: RawGatewayItem[];
        "vpn_vpnconnection"?: RawGatewayItem[];
        vpc_bandwidth?: RawBandwidthItem[];
      };
    };
  } catch {
    throw new Error(`VPN product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  const ipsecGateways = (body.product?.["vpn_vpn.ipsecvpn"] ?? [])
    .map((item) => buildGatewayTier(item))
    .filter((entry): entry is VpnGatewayTier => entry != null);

  const connectionGateways = (body.product?.["vpn_vpnconnection"] ?? [])
    .map((item) => buildGatewayTier(item))
    .filter((entry): entry is VpnGatewayTier => entry != null);

  const gateways = [...connectionGateways, ...ipsecGateways];

  const bandwidthItems = body.product?.vpc_bandwidth ?? [];
  const dedicatedBandwidth = bandwidthItems.find((item) => item.resourceSpecCode === "19_bgp");
  const sharedBandwidth = bandwidthItems.find((item) => item.resourceSpecCode === "19_share");
  const publicBandwidth = [buildBandwidthTier("Dedicated bandwidth", dedicatedBandwidth ?? {}), buildBandwidthTier("Shared bandwidth", sharedBandwidth ?? {})]
    .filter((entry): entry is VpnBandwidthTier => entry != null);

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    gateways,
    publicBandwidth,
  };
}
