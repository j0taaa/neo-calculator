import { sendHttpRequest } from "@/lib/huawei-http";
import type { PricingProductIdSet, PricingRateSet } from "@/lib/pricing-catalog-types";
import type {
  RdsComputeTier,
  RdsEngine,
  RdsInstanceClass,
  RdsInstanceType,
  RdsPricingCatalog,
  RdsStorageTier,
  RdsStorageType,
  RdsVersion,
} from "@/lib/rds-catalog";

type RawPlan = {
  productId?: string;
  billingMode?: string;
  amount?: number;
};

type RawRdsRecord = Record<string, unknown> & {
  planList?: RawPlan[];
};

const RDS_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

const mysqlVersionTokenMap = {
  dataInfo_57_: "8.0",
  dataInfo_46_: "5.7",
} as const satisfies Record<string, Extract<RdsVersion, "8.0" | "5.7">>;

const postgresqlVersionTokenMap = {
  dataInfo_78_: "17",
  dataInfo_74_: "16",
  dataInfo_73_: "15",
  dataInfo_68_: "14",
  dataInfo_67_: "13",
} as const satisfies Record<string, Extract<RdsVersion, "17" | "16" | "15" | "14" | "13">>;

function buildRdsProductInfoUrl(regionId: string) {
  const url = new URL(RDS_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "rds");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "calc");
  url.searchParams.set("sign", "common");
  return url.toString();
}

function normalizePricingMode(value: string | undefined) {
  if (value === "ONDEMAND" || value === "MONTHLY" || value === "YEARLY") {
    return value;
  }
  return null;
}

function buildRateSet(plans: RawPlan[] | undefined) {
  const prices: PricingRateSet<"ONDEMAND" | "MONTHLY" | "YEARLY"> = {};
  const productIds: PricingProductIdSet<"ONDEMAND" | "MONTHLY" | "YEARLY"> = {};

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

function parseCpu(value: unknown) {
  const text = typeof value === "string" ? value : "";
  const match = text.match(/(\d+)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseMemoryGiB(value: unknown) {
  const text = typeof value === "string" ? value : "";
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return /mb/i.test(text) || parsed >= 1024 ? parsed / 1024 : parsed;
}

function parseVersion(record: RawRdsRecord, engine: RdsEngine): RdsVersion | null {
  const token = typeof record.dbVersion === "string" ? record.dbVersion : "";
  if (engine === "MySQL") {
    return token in mysqlVersionTokenMap ? mysqlVersionTokenMap[token as keyof typeof mysqlVersionTokenMap] : null;
  }
  return token in postgresqlVersionTokenMap ? postgresqlVersionTokenMap[token as keyof typeof postgresqlVersionTokenMap] : null;
}

function parseInstanceType(record: RawRdsRecord): RdsInstanceType | null {
  const desc = typeof record.productSpecSysDesc === "string" ? record.productSpecSysDesc : "";
  const match = desc.match(/DB Instance Type:([^;]+)/);
  const value = match?.[1]?.trim() ?? "";
  if (value === "Primary/Standby" || value === "Single" || value === "Read replica") {
    return value;
  }
  return null;
}

function parseInstanceClass(record: RawRdsRecord): RdsInstanceClass | null {
  const raw = typeof record.instanceClass === "string" ? record.instanceClass : "";
  if (raw === "General-purpose") {
    return "General-purpose";
  }
  if (raw === "Delicated") {
    return "Dedicated";
  }
  return null;
}

function parseStorageType(record: RawRdsRecord): RdsStorageType | null {
  const desc = typeof record.productSpecSysDesc === "string" ? record.productSpecSysDesc : "";
  if (desc.includes("Volume Type:Flexible SSD")) {
    return "Flexible SSD";
  }
  if (desc.includes("Volume Type:Cloud SSD")) {
    return "Cloud SSD";
  }
  if (desc.includes("Volume Type:ESSD") || desc.includes("Volume Type:Extreme SSD")) {
    return "Extreme SSD";
  }
  return null;
}

function buildComputeTier(record: RawRdsRecord): RdsComputeTier | null {
  const engine = record.engineType === "MySQL" || record.engineType === "PostgreSQL" ? record.engineType : null;
  if (!engine) {
    return null;
  }

  const version = parseVersion(record, engine);
  const instanceType = parseInstanceType(record);
  const instanceClass = parseInstanceClass(record);
  const cpu = parseCpu(record.cpu);
  const memoryGiB = parseMemoryGiB(record.mem);
  const { prices, productIds } = buildRateSet(record.planList);
  if (!version || !instanceType || !instanceClass || cpu == null || memoryGiB == null || prices.ONDEMAND == null) {
    return null;
  }

  const resourceSpecCode = typeof record.resourceSpecCode === "string"
    ? record.resourceSpecCode
    : `${engine}.${version}.${instanceType}.${instanceClass}.${cpu}.${memoryGiB}`;

  return {
    engine,
    version,
    instanceType,
    instanceClass,
    cpu,
    memoryGiB,
    sizeLabel: `${cpu} vCPU${cpu === 1 ? "" : "s"}, ${memoryGiB} GB`,
    resourceSpecCode,
    prices,
    productIds,
  };
}

function buildStorageTiers(rows: RawRdsRecord[]): RdsStorageTier[] {
  const grouped = new Map<string, RdsStorageTier>();

  for (const record of rows) {
    const engine = record.engineType === "MySQL" || record.engineType === "PostgreSQL" ? record.engineType : null;
    const instanceType = parseInstanceType(record);
    const storageType = parseStorageType(record);
    if (!engine || !instanceType || !storageType) {
      continue;
    }

    const { prices, productIds } = buildRateSet(record.planList);
    const code = typeof record.resourceSpecCode === "string" ? record.resourceSpecCode : `${engine}.${instanceType}.${storageType}`;
    const key = `${engine}|${instanceType}|${storageType}`;
    const existing = grouped.get(key);
    const next = existing ?? {
      engine,
      instanceType,
      storageType,
      resourceSpecCode: code,
      prices: {},
      productIds: {},
      iopsRatePerUnit: null,
      throughputRatePerUnit: null,
    };

    if (storageType === "Flexible SSD" && code.includes(".throughput")) {
      next.throughputRatePerUnit = prices.ONDEMAND ?? next.throughputRatePerUnit ?? null;
    } else if (storageType === "Flexible SSD" && code.includes(".iops")) {
      next.iopsRatePerUnit = prices.ONDEMAND ?? next.iopsRatePerUnit ?? null;
    } else {
      next.resourceSpecCode = code;
      next.prices = prices;
      next.productIds = productIds;
    }

    grouped.set(key, next);
  }

  return [...grouped.values()].filter((tier) => tier.prices.ONDEMAND != null);
}

export function parseRdsPricingCatalogResponse(body: unknown, regionId: string): RdsPricingCatalog {
  const product = (body as { product?: Record<string, unknown> })?.product ?? {};
  const computeTiers = (Array.isArray(product["rds_rds.vm"]) ? product["rds_rds.vm"] : [])
    .map((record) => buildComputeTier(record as RawRdsRecord))
    .filter((tier): tier is RdsComputeTier => tier != null)
    .sort((left, right) => {
      if (left.engine !== right.engine) {
        return left.engine.localeCompare(right.engine);
      }
      if (left.version !== right.version) {
        return left.version.localeCompare(right.version, undefined, { numeric: true });
      }
      if (left.instanceType !== right.instanceType) {
        return left.instanceType.localeCompare(right.instanceType);
      }
      if (left.instanceClass !== right.instanceClass) {
        return left.instanceClass.localeCompare(right.instanceClass);
      }
      if (left.cpu !== right.cpu) {
        return left.cpu - right.cpu;
      }
      return left.memoryGiB - right.memoryGiB;
    });

  const storageTiers = buildStorageTiers(Array.isArray(product["rds_rds.volume"]) ? product["rds_rds.volume"] as RawRdsRecord[] : []);

  if (computeTiers.length === 0 || storageTiers.length === 0) {
    throw new Error("RDS product info response did not include any supported compute or storage tiers");
  }

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    computeTiers,
    storageTiers,
  };
}

export async function fetchRdsPricingCatalog(regionId: string): Promise<RdsPricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildRdsProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`RDS product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("RDS product info response was empty");
  }

  let body: unknown;
  try {
    body = JSON.parse(response.bodyText);
  } catch {
    throw new Error(`RDS product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  return parseRdsPricingCatalogResponse(body, regionId);
}
