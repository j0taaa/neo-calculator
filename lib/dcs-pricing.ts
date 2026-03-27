import { sendHttpRequest } from "@/lib/huawei-http";
import {
  type DcsArchitecture,
  type DcsInstanceTier,
  type DcsInstanceType,
  type DcsPricingCatalog,
  type DcsVersion,
} from "@/lib/dcs-catalog";

type RawPlan = {
  productId?: string;
  billingMode?: string;
  amount?: number;
};

type RawHourlyPlan = RawPlan & {
  billingMode: "ONDEMAND";
  amount: number;
};

type RawCatalogRecord = Record<string, unknown> & {
  planList?: RawPlan[];
};

const DCS_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildDcsProductInfoUrl(regionId: string) {
  const url = new URL(DCS_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "redis");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectRecords(value: unknown): RawCatalogRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => (isRecord(entry) ? [entry as RawCatalogRecord, ...collectRecords(entry)] : collectRecords(entry)));
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value).flatMap((entry) => collectRecords(entry));
}

function pickHourlyPlan(record: RawCatalogRecord): RawHourlyPlan | null {
  const plans = Array.isArray(record.planList) ? record.planList : [];
  return plans.find(
    (plan): plan is RawHourlyPlan => plan.billingMode === "ONDEMAND" && typeof plan.amount === "number" && Number.isFinite(plan.amount),
  ) ?? null;
}

function parseVersion(record: RawCatalogRecord): DcsVersion | null {
  if (typeof record.versionKey === "string" && /^(7\.0|6\.0|5\.0|4\.0)$/.test(record.versionKey)) {
    return record.versionKey as DcsVersion;
  }

  const candidates = [record.version, record.redisVersion, record.engineVersion, record.productSpecSysDesc, record.resourceSpecCode, record.productId]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const match = candidates.match(/(?:^|[^0-9])(7\.0|6\.0|5\.0|4\.0)(?:[^0-9]|$)/);
  return match ? (match[1] as DcsVersion) : null;
}

function parseInstanceType(record: RawCatalogRecord): DcsInstanceType | null {
  if (record.cache_mode === "single_node" || record.instanceType === "single") return "Single-node";
  if (record.cache_mode === "cluster" || record.instanceType === "cluster") return "Redis Cluster";
  if (record.cache_mode === "master_standby" || record.instanceType === "master_standby") return "Master/Standby";

  const candidates = [record.instanceType, record.type, record.mode, record.productSpecSysDesc, record.resourceSpecCode, record.productId]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (candidates.includes("single")) return "Single-node";
  if (candidates.includes("cluster")) return "Redis Cluster";
  if ((candidates.includes("master") && candidates.includes("standby")) || candidates.includes("ha")) return "Master/Standby";
  return null;
}

function parseArchitecture(record: RawCatalogRecord): DcsArchitecture | null {
  if (record.cpu === "aarch64") return "ARM | DRAM";
  if (record.cpu === "x86_64") return "x86 | DRAM";

  const candidates = [record.architecture, record.cpuArch, record.cpuType, record.productSpecSysDesc, record.resourceSpecCode, record.productId]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (candidates.includes("arm")) return "ARM | DRAM";
  if (candidates.includes("x86") || candidates.includes("x64")) return "x86 | DRAM";
  return null;
}

function parseMemoryGiB(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value >= 1024 ? value / 1024 : value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed >= 1024 ? parsed / 1024 : parsed;
    }

    const leadingNumberMatch = value.match(/^(\d+(?:\.\d+)?)/);
    if (leadingNumberMatch) {
      const leadingNumber = Number(leadingNumberMatch[1]);
      if (Number.isFinite(leadingNumber) && leadingNumber > 0) {
        if (/mb/i.test(value)) {
          return leadingNumber / 1024;
        }
        return leadingNumber;
      }
    }

    const gbMatch = value.match(/(\d+(?:\.\d+)?)\s*gb/i);
    if (gbMatch) {
      return Number(gbMatch[1]);
    }
    const mbMatch = value.match(/(\d+(?:\.\d+)?)\s*mb/i);
    if (mbMatch) {
      return Number(mbMatch[1]) / 1024;
    }
  }

  return null;
}

function formatSpecification(memoryGiB: number) {
  return `${Number.isInteger(memoryGiB) ? memoryGiB.toFixed(0) : String(memoryGiB)} GB`;
}

function parseReplicas(record: RawCatalogRecord, instanceType: DcsInstanceType) {
  if (instanceType === "Single-node") {
    return null;
  }

  const directCandidates = [record.replicas, record.replica, record.replicaNum, record.standbyNum, record.slaveNum, record.nodeNum, record.repl_spec, record.replica_Number];
  for (const candidate of directCandidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.floor(candidate);
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed);
      }

      const match = candidate.match(/(\d+)/);
      if (match) {
        const leading = Number(match[1]);
        if (Number.isFinite(leading) && leading > 0) {
          return Math.floor(leading);
        }
      }
    }
  }

  const text = [record.productSpecSysDesc, record.resourceSpecCode, record.productId]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const match = text.match(/(?:replica|standby|slave)[^\d]*(\d+)/i) ?? text.match(/(?:^|\.|_)([1-6])rep(?:lica)?(?:\.|_|$)/i);
  if (match) {
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return instanceType === "Master/Standby" ? 2 : null;
}

function buildInstanceTier(record: RawCatalogRecord): DcsInstanceTier | null {
  const plan = pickHourlyPlan(record);
  if (!plan) {
    return null;
  }

  const productIdCandidates = [record.productId, plan.productId].filter((value): value is string => typeof value === "string");
  const combinedText = [record.resourceSpecCode, record.productSpecSysDesc, ...productIdCandidates]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  if (!combinedText.includes("redis")) {
    return null;
  }
  if (combinedText.includes("bandwidth")) {
    return null;
  }
  if (record.product_type === "professional" || record.resourceSpecType === "dcs_enterprise" || combinedText.includes("product_type:professional")) {
    return null;
  }

  const version = parseVersion(record);
  const instanceType = parseInstanceType(record);
  const architecture = parseArchitecture(record);
  const memoryGiB = parseMemoryGiB(record.memory ?? record.mem ?? record.capacity ?? record.size ?? record.specification);
  if (!version || !instanceType || !architecture || memoryGiB == null) {
    return null;
  }

  if (instanceType !== "Redis Cluster" && memoryGiB > 64) {
    return null;
  }
  if (instanceType === "Redis Cluster" && memoryGiB < 4) {
    return null;
  }

  return {
    edition: "Basic",
    version,
    instanceType,
    architecture,
    replicas: parseReplicas(record, instanceType),
    specification: formatSpecification(memoryGiB),
    memoryGiB,
    resourceSpecCode:
      typeof record.resourceSpecCode === "string" && record.resourceSpecCode
        ? record.resourceSpecCode
        : productIdCandidates[0] ?? `${version}-${instanceType}-${architecture}-${memoryGiB}`,
    prices: {
      ONDEMAND: plan.amount,
    },
    productIds: {
      ONDEMAND: plan.productId ?? productIdCandidates[0],
    },
  };
}

function parseBandwidthUnits(record: RawCatalogRecord) {
  const candidates = [record.bandwidth, record.bandwidthMbit, record.measureValue, record.value];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  const text = [record.productSpecSysDesc, record.resourceSpecCode, record.productId]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const match = text.match(/(\d+(?:\.\d+)?)\s*mbit/i);
  return match ? Number(match[1]) : 1;
}

function parseBandwidthRate(record: RawCatalogRecord) {
  const plan = pickHourlyPlan(record);
  if (!plan) {
    return null;
  }

  const text = [record.type, record.productSpecSysDesc, record.resourceSpecCode, record.productId]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (!text.includes("bandwidth")) {
    return null;
  }

  const units = parseBandwidthUnits(record);
  return units > 0 ? plan.amount / units : null;
}

export function parseDcsPricingCatalogResponse(body: unknown, regionId: string): DcsPricingCatalog {
  const product = isRecord(body) ? body.product : null;
  const records = collectRecords(product);
  const tiersByKey = new Map<string, DcsInstanceTier>();
  let bandwidthRatePerMbitHour: number | null = null;

  for (const record of records) {
    const instanceTier = buildInstanceTier(record);
    if (instanceTier) {
      const key = [
        instanceTier.version,
        instanceTier.instanceType,
        instanceTier.architecture,
        instanceTier.replicas ?? "single",
        instanceTier.specification,
      ].join("|");
      const existing = tiersByKey.get(key);
      if (!existing || (existing.prices.ONDEMAND ?? Number.POSITIVE_INFINITY) > (instanceTier.prices.ONDEMAND ?? Number.POSITIVE_INFINITY)) {
        tiersByKey.set(key, instanceTier);
      }
    }

    const bandwidthRate = parseBandwidthRate(record);
    if (bandwidthRate != null && (bandwidthRatePerMbitHour == null || bandwidthRate < bandwidthRatePerMbitHour)) {
      bandwidthRatePerMbitHour = bandwidthRate;
    }
  }

  const instanceTiers = [...tiersByKey.values()].sort((left, right) => {
    if (left.version !== right.version) return right.version.localeCompare(left.version);
    if (left.instanceType !== right.instanceType) return left.instanceType.localeCompare(right.instanceType);
    if (left.architecture !== right.architecture) return left.architecture.localeCompare(right.architecture);
    if ((left.replicas ?? 0) !== (right.replicas ?? 0)) return (left.replicas ?? 0) - (right.replicas ?? 0);
    return left.memoryGiB - right.memoryGiB;
  });

  if (instanceTiers.length === 0) {
    throw new Error("DCS product info response did not include any supported Redis tiers");
  }

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    edition: "Basic",
    instanceTiers,
    bandwidthRatePerMbitHour,
  };
}

export async function fetchDcsPricingCatalog(regionId: string): Promise<DcsPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildDcsProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`DCS product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("DCS product info response was empty");
  }

  let body: unknown;
  try {
    body = JSON.parse(response.bodyText);
  } catch {
    throw new Error(`DCS product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  return parseDcsPricingCatalogResponse(body, regionId);
}
