import { sendHttpRequest } from "@/lib/huawei-http";
import { type ModelArtsComputeTier, type ModelArtsPricingCatalog, type ModelArtsPricingMode, type ModelArtsStorageTier } from "@/lib/modelarts-catalog";

type RawPlan = {
  productId?: string;
  billingMode?: string;
  amount?: number;
};

type RawComputeItem = {
  resourceSpecCode?: string;
  purpose?: string;
  cpuSpecification?: string;
  mem?: string;
  planList?: RawPlan[];
};

type RawStorageItem = {
  resourceSpecCode?: string;
  type?: string;
  planList?: RawPlan[];
};

const MODELARTS_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildModelArtsProductInfoUrl(regionId: string) {
  const url = new URL(MODELARTS_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "modelarts");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function normalizePricingMode(value: string | undefined): ModelArtsPricingMode | null {
  if (value === "ONDEMAND" || value === "MONTHLY" || value === "YEARLY") {
    return value;
  }

  return null;
}

function parseMemoryGiB(value: string | undefined) {
  const match = value?.match(/(\d+)BSSUNIT/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed / 1024;
}

function parseCpuUnits(resourceSpecCode: string | undefined) {
  const match = resourceSpecCode?.match(/\.cpu\.(\d+)u(d)?$/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildRateSet(plans: RawPlan[] | undefined) {
  const prices: Partial<Record<ModelArtsPricingMode, number>> = {};
  const productIds: Partial<Record<ModelArtsPricingMode, string>> = {};

  for (const plan of plans ?? []) {
    const mode = normalizePricingMode(plan.billingMode);
    if (!mode || typeof plan.amount !== "number" || !Number.isFinite(plan.amount)) {
      continue;
    }

    prices[mode] = plan.amount;
    if (typeof plan.productId === "string" && plan.productId) {
      productIds[mode] = plan.productId;
    }
  }

  return { prices, productIds };
}

function buildComputeTier(item: RawComputeItem): ModelArtsComputeTier | null {
  const cpuUnits = parseCpuUnits(item.resourceSpecCode);
  if (cpuUnits == null) {
    return null;
  }

  const resourceType = item.purpose === "DedicatePool" ? "Dedicated Resource Pool" : "Public Resource Pool";
  const specification = resourceType === "Dedicated Resource Pool"
    ? `Compute CPU dedicated instance (${cpuUnits}U)`
    : `Compute CPU instance (${cpuUnits}U)`;
  const { prices, productIds } = buildRateSet(item.planList);

  if (Object.keys(prices).length === 0) {
    return null;
  }

  return {
    resourceType,
    specification,
    resourceSpecCode: item.resourceSpecCode ?? specification,
    cpuUnits,
    memoryGiB: parseMemoryGiB(item.mem) ?? parseMemoryGiB(item.cpuSpecification),
    prices,
    productIds,
  };
}

function buildStorageTier(items: RawStorageItem[]): ModelArtsStorageTier | null {
  const exactMatch = items.find((item) => item.resourceSpecCode === "modelarts.storage.volume");
  const fallbackMatch = items.find((item) => (item.type ?? "").toLowerCase() === "instance storage");
  const source = exactMatch ?? fallbackMatch;
  if (!source) {
    return null;
  }

  const { prices, productIds } = buildRateSet(source.planList);
  if (prices.ONDEMAND == null) {
    return null;
  }

  return {
    resourceType: "EVS Storage",
    specification: "Instance storage",
    resourceSpecCode: source.resourceSpecCode ?? "modelarts.storage.volume",
    prices,
    productIds,
  };
}

export async function fetchModelArtsPricingCatalog(regionId: string): Promise<ModelArtsPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildModelArtsProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`ModelArts product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("ModelArts product info response was empty");
  }

  let body: {
    product?: {
      modelarts_modelarts?: RawComputeItem[];
      "modelarts_modelarts.volume"?: RawStorageItem[];
    };
  };
  try {
    body = JSON.parse(response.bodyText) as {
      product?: {
        modelarts_modelarts?: RawComputeItem[];
        "modelarts_modelarts.volume"?: RawStorageItem[];
      };
    };
  } catch {
    throw new Error(`ModelArts product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  const computeTiers = (body.product?.modelarts_modelarts ?? [])
    .map((item) => buildComputeTier(item))
    .filter((entry): entry is ModelArtsComputeTier => entry != null)
    .sort((left, right) => {
      if (left.resourceType !== right.resourceType) {
        return left.resourceType.localeCompare(right.resourceType);
      }

      return left.cpuUnits - right.cpuUnits;
    });
  const storageTier = buildStorageTier(body.product?.["modelarts_modelarts.volume"] ?? []);

  if (computeTiers.length === 0 && !storageTier) {
    throw new Error("ModelArts product info response did not include any supported CPU or storage tiers");
  }

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    serviceType: "AI Development Lifecycle",
    computeTiers,
    storageTier,
  };
}
