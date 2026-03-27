import { sendHttpRequest } from "@/lib/huawei-http";
import {
  type WorkspaceCpuOption,
  type WorkspaceDesktopTier,
  type WorkspaceDiskTier,
  type WorkspaceDiskType,
  type WorkspaceMemoryOption,
  type WorkspacePricingCatalog,
} from "@/lib/workspace-catalog";

type RawPlan = {
  productId?: string;
  billingMode?: string;
  amount?: number;
};

type RawCatalogRecord = Record<string, unknown> & {
  planList?: RawPlan[];
};

const WORKSPACE_PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const DEFAULT_CURRENCY = "USD";

function buildWorkspaceProductInfoUrl(regionId: string) {
  const url = new URL(WORKSPACE_PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "workspace");
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

function pickHourlyPlan(record: RawCatalogRecord) {
  const plans = Array.isArray(record.planList) ? record.planList : [];
  return plans.find((plan) => plan.billingMode === "ONDEMAND" && typeof plan.amount === "number" && Number.isFinite(plan.amount)) ?? null;
}

function parseCpuCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const direct = Number(value);
    if (Number.isFinite(direct) && direct > 0) {
      return Math.floor(direct);
    }

    const match = value.match(/(\d+)\s*v?cpu/i);
    if (match) {
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }

  return null;
}

function parseMemoryGiB(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value >= 1024 ? value / 1024 : value;
  }

  if (typeof value === "string") {
    const direct = Number(value);
    if (Number.isFinite(direct) && direct > 0) {
      return direct >= 1024 ? direct / 1024 : direct;
    }

    const gbMatch = value.match(/(\d+)\s*gb/i);
    if (gbMatch) {
      return Number(gbMatch[1]);
    }
    const mbMatch = value.match(/(\d+)\s*mb/i);
    if (mbMatch) {
      return Number(mbMatch[1]) / 1024;
    }
  }

  return null;
}

function formatCpuOption(cpuCount: number): WorkspaceCpuOption | null {
  if (cpuCount === 2) return "2 vCPUs";
  if (cpuCount === 4) return "4 vCPUs";
  if (cpuCount === 8) return "8 vCPUs";
  return null;
}

function formatMemoryOption(memoryGiB: number): WorkspaceMemoryOption | null {
  if (memoryGiB === 4) return "4 GB";
  if (memoryGiB === 8) return "8 GB";
  if (memoryGiB === 16) return "16 GB";
  if (memoryGiB === 32) return "32 GB";
  return null;
}

function inferDiskType(record: RawCatalogRecord): WorkspaceDiskType | null {
  const candidates = [
    record.resourceSpecCode,
    record.type,
    record.diskType,
    record.volumeType,
    record.productSpecSysDesc,
    record.descriptions,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (candidates.includes("workspace.volume.high") || candidates.includes(" sas") || candidates.includes("high i/o") || candidates.includes("high_io")) {
    return "High I/O";
  }
  if (candidates.includes("gpssd") || candidates.includes("general purpose") || candidates.includes("general-purpose")) {
    return "General purpose SSD";
  }
  if (candidates.includes("ultra-high") || candidates.includes("ultrahigh") || candidates.includes("workspace.volume.ssd") || candidates.includes(" ssd")) {
    return "Ultra-high I/O";
  }

  return null;
}

function buildDesktopTier(record: RawCatalogRecord): WorkspaceDesktopTier | null {
  const plan = pickHourlyPlan(record);
  if (!plan) {
    return null;
  }

  const productIdCandidates = [record.productId, plan.productId].filter((value): value is string => typeof value === "string");
  if (!productIdCandidates.some((value) => value.startsWith("workspace."))) {
    return null;
  }

  const packageText = [record.packageType, record.productSpecSysDesc, record.descriptions]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  if (!packageText.includes("ultimate")) {
    return null;
  }

  const architectureText = [record.architecture, ...productIdCandidates].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  if (!architectureText.includes("x86")) {
    return null;
  }

  const cpuCount = parseCpuCount(record.cpu ?? record.vcpu ?? record.cpuCount ?? record.cpuNum);
  const memoryGiB = parseMemoryGiB(record.memory ?? record.mem ?? record.ram ?? record.memSize);
  if (cpuCount == null || memoryGiB == null) {
    return null;
  }

  const cpu = formatCpuOption(cpuCount);
  const memory = formatMemoryOption(memoryGiB);
  if (!cpu || !memory) {
    return null;
  }

  return {
    architecture: "x86 desktop",
    specification: "Ultimate",
    cpu,
    memory,
    cpuCount,
    memoryGiB,
    resourceSpecCode: typeof record.resourceSpecCode === "string" && record.resourceSpecCode ? record.resourceSpecCode : productIdCandidates[0] ?? `${cpu}-${memory}`,
    prices: {
      ONDEMAND: plan.amount,
    },
    productIds: {
      ONDEMAND: plan.productId ?? productIdCandidates[0],
    },
  };
}

function buildDiskTier(record: RawCatalogRecord): WorkspaceDiskTier | null {
  const plan = pickHourlyPlan(record);
  if (!plan) {
    return null;
  }

  const diskType = inferDiskType(record);
  if (!diskType) {
    return null;
  }

  return {
    diskType,
    resourceSpecCode: typeof record.resourceSpecCode === "string" && record.resourceSpecCode ? record.resourceSpecCode : String(record.type ?? diskType),
    prices: {
      ONDEMAND: plan.amount,
    },
    productIds: {
      ONDEMAND: plan.productId,
    },
  };
}

function mergeDesktopTier(target: Map<string, WorkspaceDesktopTier>, tier: WorkspaceDesktopTier) {
  const key = `${tier.cpu}:${tier.memory}`;
  const existing = target.get(key);
  if (!existing || (existing.prices.ONDEMAND ?? Number.POSITIVE_INFINITY) > (tier.prices.ONDEMAND ?? Number.POSITIVE_INFINITY)) {
    target.set(key, tier);
  }
}

function mergeDiskTier(target: Map<WorkspaceDiskType, WorkspaceDiskTier>, tier: WorkspaceDiskTier) {
  const existing = target.get(tier.diskType);
  if (!existing || (existing.prices.ONDEMAND ?? Number.POSITIVE_INFINITY) > (tier.prices.ONDEMAND ?? Number.POSITIVE_INFINITY)) {
    target.set(tier.diskType, tier);
  }
}

export function parseWorkspacePricingCatalogResponse(body: unknown, regionId: string): WorkspacePricingCatalog {
  const product = isRecord(body) ? body.product : null;
  const records = collectRecords(product);
  const desktopTiersByKey = new Map<string, WorkspaceDesktopTier>();
  const diskTiersByKey = new Map<WorkspaceDiskType, WorkspaceDiskTier>();

  for (const record of records) {
    const desktopTier = buildDesktopTier(record);
    if (desktopTier) {
      mergeDesktopTier(desktopTiersByKey, desktopTier);
    }

    const diskTier = buildDiskTier(record);
    if (diskTier) {
      mergeDiskTier(diskTiersByKey, diskTier);
    }
  }

  const desktopTiers = [...desktopTiersByKey.values()].sort((left, right) => {
    if (left.cpuCount !== right.cpuCount) {
      return left.cpuCount - right.cpuCount;
    }
    return left.memoryGiB - right.memoryGiB;
  });
  const diskOrder: WorkspaceDiskType[] = ["High I/O", "Ultra-high I/O", "General purpose SSD"];
  const diskTiers = diskOrder.map((key) => diskTiersByKey.get(key)).filter((value): value is WorkspaceDiskTier => value != null);

  if (desktopTiers.length === 0 || diskTiers.length === 0) {
    throw new Error("Workspace product info response did not include any supported desktop or disk tiers");
  }

  return {
    currency: DEFAULT_CURRENCY,
    regionId,
    architecture: "x86 desktop",
    specification: "Ultimate",
    desktopTiers,
    diskTiers,
  };
}

export async function fetchWorkspacePricingCatalog(regionId: string): Promise<WorkspacePricingCatalog> {
  const response = await sendHttpRequest({
    method: "GET",
    url: buildWorkspaceProductInfoUrl(regionId),
    headers: {
      accept: "application/json, text/plain, */*",
      origin: "https://www.huaweicloud.com",
      referer: "https://www.huaweicloud.com/intl/en-us/pricing/calculator.html",
      "user-agent": "Mozilla/5.0",
    },
    timeoutMs: 30_000,
  });

  if (!response.ok) {
    throw new Error(`Workspace product info request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.bodyText.trim()) {
    throw new Error("Workspace product info response was empty");
  }

  let body: unknown;
  try {
    body = JSON.parse(response.bodyText);
  } catch {
    throw new Error(`Workspace product info response was not valid JSON (${response.contentType || "unknown content-type"})`);
  }

  return parseWorkspacePricingCatalogResponse(body, regionId);
}
