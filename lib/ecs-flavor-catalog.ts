import { db } from "@/lib/db";

export type BillingMode = "ONDEMAND" | "MONTHLY" | "YEARLY" | "RI";

type CatalogPlan = {
  billingMode?: string;
  originType?: string;
  amountType?: string;
  productId?: string;
  siteCode?: string;
  periodNum?: number | null;
  billingEvent?: string;
  amount?: number;
  [key: string]: unknown;
};

type RawFlavor = {
  resourceSpecCode?: string;
  cpu?: string;
  mem?: string;
  instanceArch?: string;
  performType?: string;
  series?: string;
  productSpecDesc?: string;
  productSpecSysDesc?: string;
  planList?: CatalogPlan[];
  bakPlanList?: CatalogPlan[];
  [key: string]: unknown;
};

type FlavorRow = {
  region_id: string;
  resource_spec_code: string;
  family: string | null;
  architecture: string | null;
  series: string | null;
  description: string | null;
  cpu: number;
  ram_gib: number;
  flavor_json: string;
  updated_at: string;
};

type FlavorPriceRow = {
  resource_spec_code: string;
  billing_mode: BillingMode;
  amount: number;
  currency: string;
};

type RegionRow = {
  region_id: string;
  name: string;
};

type DiscoveredRegion = {
  id: string;
  name: string;
};

export type StoredEcsFlavor = {
  regionId: string;
  resourceSpecCode: string;
  family: string | null;
  architecture: string | null;
  series: string | null;
  description: string | null;
  cpu: number;
  ramGiB: number;
  prices: Partial<Record<BillingMode, number>>;
  currency: string;
  updatedAt: string;
};

export type SyncOptions = {
  force?: boolean;
  regionIds?: string[];
  includeOnDemandBackfill?: boolean;
  onDemandBackfillLimit?: number;
};

const BILLING_MODES: BillingMode[] = ["ONDEMAND", "MONTHLY", "YEARLY", "RI"];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CURRENCY = "USD";
const REGION_DISCOVERY_URL =
  "https://sa-brazil-1-console.huaweicloud.com/apiexplorer/new/v6/regions?product_short=ECS&api_name=ListFlavors";
const PRODUCT_INFO_URL =
  "https://portal-intl.huaweicloud.com/api/calculator/rest/cbc/portalcalculatornodeservice/v4/api/productInfo";
const PRICE_URL =
  "https://portal-intl.huaweicloud.com/api/cbc/global/rest/BSS/billing/ratingservice/v2/inquiry/resource?servieName=ecs";
const GPSSD_CODE = "GPSSD";
const META_LAST_STARTED = "ecsCatalogLastStartedAt";
const META_LAST_COMPLETED = "ecsCatalogLastCompletedAt";
const META_LAST_FULL_COMPLETED = "ecsCatalogLastFullCompletedAt";
const META_LAST_ERROR = "ecsCatalogLastError";

declare global {
  var __neoEcsCatalogSyncPromise: Promise<void> | undefined;
  var __neoEcsCatalogIntervalStarted: boolean | undefined;
}

function countPopulatedValues(record: Record<string, unknown>): number {
  return Object.values(record).filter((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;
}

function buildPlanKey(plan: CatalogPlan): string {
  return JSON.stringify([
    plan.billingMode ?? "",
    plan.originType ?? "",
    plan.amountType ?? "",
    plan.productId ?? "",
    plan.siteCode ?? "",
    plan.periodNum ?? "",
    plan.billingEvent ?? "",
    typeof plan.amount === "number" ? plan.amount : "",
  ]);
}

function mergePlans(primary: CatalogPlan[] = [], secondary: CatalogPlan[] = []): CatalogPlan[] {
  const merged = new Map<string, CatalogPlan>();

  for (const plan of [...primary, ...secondary]) {
    const key = buildPlanKey(plan);
    const current = merged.get(key);
    if (!current || countPopulatedValues(plan) > countPopulatedValues(current)) {
      merged.set(key, plan);
    }
  }

  return [...merged.values()];
}

function dedupeFlavors(rawFlavors: RawFlavor[]): RawFlavor[] {
  const merged = new Map<string, RawFlavor>();

  for (const candidate of rawFlavors) {
    const code = typeof candidate.resourceSpecCode === "string" ? candidate.resourceSpecCode.trim() : "";
    if (!code) continue;

    const current = merged.get(code);
    if (!current) {
      merged.set(code, {
        ...candidate,
        resourceSpecCode: code,
        planList: [...(candidate.planList ?? [])],
        bakPlanList: [...(candidate.bakPlanList ?? [])],
      });
      continue;
    }

    const preferred =
      countPopulatedValues(candidate as Record<string, unknown>) >= countPopulatedValues(current as Record<string, unknown>)
        ? candidate
        : current;
    const fallback = preferred === candidate ? current : candidate;

    merged.set(code, {
      ...fallback,
      ...preferred,
      resourceSpecCode: code,
      planList: mergePlans(preferred.planList, fallback.planList),
      bakPlanList: mergePlans(preferred.bakPlanList, fallback.bakPlanList),
    });
  }

  return [...merged.values()];
}

function parseCpuCount(flavor: RawFlavor): number {
  const spec = typeof flavor.productSpecSysDesc === "string" ? flavor.productSpecSysDesc : "";
  const specMatch = spec.match(/vCPUs:(\d+)CORE/i);
  if (specMatch) {
    return Number.parseInt(specMatch[1], 10);
  }

  const cpuText = typeof flavor.cpu === "string" ? flavor.cpu : "";
  const cpuMatch = cpuText.match(/(\d+)/);
  return cpuMatch ? Number.parseInt(cpuMatch[1], 10) : 0;
}

function parseRamGiB(flavor: RawFlavor): number {
  const spec = typeof flavor.productSpecSysDesc === "string" ? flavor.productSpecSysDesc : "";
  const mbMatch = spec.match(/Memory:(\d+)MB/i);
  if (mbMatch) {
    return Number.parseInt(mbMatch[1], 10) / 1024;
  }

  const memText = typeof flavor.mem === "string" ? flavor.mem : "";
  const memMatch = memText.match(/(\d+(?:\.\d+)?)/);
  return memMatch ? Number.parseFloat(memMatch[1]) : 0;
}

function parseArchitecture(flavor: RawFlavor): string | null {
  if (typeof flavor.instanceArch === "string" && flavor.instanceArch.trim()) {
    return flavor.instanceArch.trim();
  }

  const spec = typeof flavor.productSpecSysDesc === "string" ? flavor.productSpecSysDesc : "";
  const match = spec.match(/CPU Architecture:([^;]+)/i);
  return match?.[1]?.trim() || null;
}

function extractFamily(flavor: RawFlavor): string | null {
  if (typeof flavor.performType === "string" && flavor.performType.trim()) {
    return flavor.performType.trim();
  }

  const spec = typeof flavor.productSpecSysDesc === "string" ? flavor.productSpecSysDesc : "";
  const match = spec.match(/Type:([^;]+)/i);
  return match?.[1]?.trim() || null;
}

function getFlavorDescription(flavor: RawFlavor): string | null {
  if (typeof flavor.productSpecDesc === "string" && flavor.productSpecDesc.trim()) {
    return flavor.productSpecDesc.trim();
  }

  if (typeof flavor.productSpecSysDesc === "string" && flavor.productSpecSysDesc.trim()) {
    return flavor.productSpecSysDesc.trim();
  }

  return null;
}

function getAllPlans(flavor: RawFlavor): CatalogPlan[] {
  return [...(flavor.planList ?? []), ...(flavor.bakPlanList ?? [])];
}

function pickLowestAmount(plans: CatalogPlan[]): number | null {
  const amounts = plans
    .map((plan) => (typeof plan.amount === "number" && Number.isFinite(plan.amount) ? plan.amount : Number.NaN))
    .filter(Number.isFinite);

  if (!amounts.length) {
    return null;
  }

  return Math.min(...amounts);
}

function getFlavorPriceForMode(flavor: RawFlavor, billingMode: BillingMode): number | null {
  const plans = getAllPlans(flavor).filter(
    (plan) => plan.billingMode === billingMode && typeof plan.amount === "number" && Number.isFinite(plan.amount),
  );

  if (!plans.length) {
    return null;
  }

  if (billingMode === "RI") {
    const preferred = plans.filter((plan) => {
      const originType = typeof plan.originType === "string" ? plan.originType : "";
      const amountType = typeof plan.amountType === "string" ? plan.amountType : "";
      return originType === "perPrice" || amountType.includes("perPrice");
    });
    const oneYear = preferred.filter((plan) => (plan.periodNum ?? 1) === 1);
    return pickLowestAmount(oneYear) ?? pickLowestAmount(preferred) ?? pickLowestAmount(plans);
  }

  const periodOnePlans = plans.filter((plan) => (plan.periodNum ?? 1) === 1);
  return pickLowestAmount(periodOnePlans) ?? pickLowestAmount(plans);
}

function buildProductInfoUrl(regionId: string): string {
  const url = new URL(PRODUCT_INFO_URL);
  url.searchParams.set("urlPath", "ecs");
  url.searchParams.set("tag", "general.online.portal");
  url.searchParams.set("region", regionId);
  url.searchParams.set("tab", "detail");
  url.searchParams.set("sign", "common");
  return url.toString();
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function discoverCatalogRegions(): Promise<DiscoveredRegion[]> {
  const body = (await fetchJson(REGION_DISCOVERY_URL, {
    headers: {
      "X-Language": "en-us",
    },
  })) as { regions?: Array<{ region_id?: string; name?: string }> };

  return (body.regions ?? [])
    .map((region) => ({
      id: region.region_id?.trim() ?? "",
      name: region.name?.trim() || region.region_id?.trim() || "",
    }))
    .filter((region) => Boolean(region.id));
}

async function fetchRegionCatalog(regionId: string): Promise<RawFlavor[]> {
  const body = (await fetchJson(buildProductInfoUrl(regionId), {
    headers: {
      accept: "application/json",
    },
  })) as { product?: { ec2_vm?: RawFlavor[] } };

  return Array.isArray(body.product?.ec2_vm) ? dedupeFlavors(body.product.ec2_vm) : [];
}

function buildOnDemandPriceRequest(regionId: string, flavorCode: string): string {
  return JSON.stringify({
    regionId,
    chargingMode: 1,
    periodType: 4,
    periodNum: 1,
    subscriptionNum: 1,
    siteCode: "HWC",
    productInfos: [
      {
        id: `${regionId}-${flavorCode}-vm`,
        cloudServiceType: "hws.service.type.ec2",
        resourceType: "hws.resource.type.vm",
        resourceSpecCode: flavorCode,
        productNum: 1,
        usageFactor: "Duration",
        usageMeasureId: 4,
        usageValue: 1,
      },
      {
        id: `${regionId}-${GPSSD_CODE}-disk`,
        cloudServiceType: "hws.service.type.ebs",
        resourceType: "hws.resource.type.volume",
        resourceSpecCode: GPSSD_CODE,
        productNum: 1,
        resourceSize: 1,
        resouceSizeMeasureId: 17,
        usageFactor: "Duration",
        usageMeasureId: 4,
        usageValue: 1,
      },
    ],
  });
}

async function fetchOnDemandFlavorPrice(regionId: string, flavorCode: string): Promise<number | null> {
  const response = await fetch(PRICE_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: buildOnDemandPriceRequest(regionId, flavorCode),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    productRatingResult?: Array<{ amount?: number }>;
  };

  const amount = body.productRatingResult?.[0]?.amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

function getMeta(key: string): string | null {
  const row = db.query<{ value: string }, [string]>("SELECT value FROM ecs_catalog_meta WHERE key = ?").get(key);
  return row?.value ?? null;
}

function setMeta(key: string, value: string | null) {
  if (value === null) {
    db.query("DELETE FROM ecs_catalog_meta WHERE key = ?").run(key);
    return;
  }

  db.query(
    `
      INSERT INTO ecs_catalog_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
  ).run(key, value);
}

function replaceRegionCatalog(regionId: string, regionName: string, flavors: RawFlavor[], updatedAt: string) {
  const tx = db.transaction(() => {
    db.query(
      `
        INSERT INTO ecs_catalog_region (region_id, name, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(region_id) DO UPDATE SET
          name = excluded.name,
          updated_at = excluded.updated_at
      `,
    ).run(regionId, regionName, updatedAt);

    db.query("DELETE FROM ecs_flavor_price WHERE region_id = ? AND source = 'catalog_plan'").run(regionId);
    db.query("DELETE FROM ecs_flavor WHERE region_id = ?").run(regionId);

    const insertFlavor = db.query(
      `
        INSERT INTO ecs_flavor (
          region_id,
          resource_spec_code,
          family,
          architecture,
          series,
          description,
          cpu,
          ram_gib,
          flavor_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    const insertFlavorPrice = db.query(
      `
        INSERT INTO ecs_flavor_price (
          region_id,
          resource_spec_code,
          billing_mode,
          amount,
          currency,
          source,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(region_id, resource_spec_code, billing_mode) DO UPDATE SET
          amount = excluded.amount,
          currency = excluded.currency,
          source = excluded.source,
          updated_at = excluded.updated_at
      `,
    );

    for (const flavor of flavors) {
      const code = typeof flavor.resourceSpecCode === "string" ? flavor.resourceSpecCode.trim() : "";
      if (!code) continue;

      insertFlavor.run(
        regionId,
        code,
        extractFamily(flavor),
        parseArchitecture(flavor),
        typeof flavor.series === "string" && flavor.series.trim() ? flavor.series.trim() : null,
        getFlavorDescription(flavor),
        parseCpuCount(flavor),
        parseRamGiB(flavor),
        JSON.stringify(flavor),
        updatedAt,
      );

      for (const mode of BILLING_MODES) {
        const amount = getFlavorPriceForMode(flavor, mode);
        if (amount === null) continue;

        insertFlavorPrice.run(regionId, code, mode, amount, DEFAULT_CURRENCY, "catalog_plan", updatedAt);
      }
    }
  });

  tx();
}

function upsertOnDemandPrice(regionId: string, flavorCode: string, amount: number, updatedAt: string) {
  db.query(
    `
      INSERT INTO ecs_flavor_price (
        region_id,
        resource_spec_code,
        billing_mode,
        amount,
        currency,
        source,
        updated_at
      ) VALUES (?, ?, 'ONDEMAND', ?, ?, 'rate_inquiry', ?)
      ON CONFLICT(region_id, resource_spec_code, billing_mode) DO UPDATE SET
        amount = excluded.amount,
        currency = excluded.currency,
        source = excluded.source,
        updated_at = excluded.updated_at
    `,
  ).run(regionId, flavorCode, amount, DEFAULT_CURRENCY, updatedAt);
}

function getStoredRegionName(regionId: string): string {
  const row = db.query<RegionRow, [string]>("SELECT region_id, name FROM ecs_catalog_region WHERE region_id = ?").get(regionId);
  return row?.name ?? regionId;
}

function getStoredFlavorCount(regionId: string): number {
  const row = db.query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM ecs_flavor WHERE region_id = ?").get(regionId);
  return row?.count ?? 0;
}

async function syncSingleRegion(regionId: string, regionName: string, includeOnDemandBackfill: boolean, onDemandBackfillLimit: number) {
  const updatedAt = new Date().toISOString();
  const flavors = await fetchRegionCatalog(regionId);
  replaceRegionCatalog(regionId, regionName, flavors, updatedAt);

  if (!includeOnDemandBackfill) {
    return;
  }

  let backfilled = 0;
  for (const flavor of flavors) {
    const code = typeof flavor.resourceSpecCode === "string" ? flavor.resourceSpecCode.trim() : "";
    if (!code || getFlavorPriceForMode(flavor, "ONDEMAND") !== null) {
      continue;
    }

    if (backfilled >= onDemandBackfillLimit) {
      break;
    }

    const amount = await fetchOnDemandFlavorPrice(regionId, code);
    if (amount !== null) {
      upsertOnDemandPrice(regionId, code, amount, new Date().toISOString());
    }
    backfilled += 1;
  }
}

function isFullRefreshStale() {
  const lastCompletedAt = getMeta(META_LAST_FULL_COMPLETED);
  if (!lastCompletedAt) {
    return true;
  }

  const lastCompletedMs = Date.parse(lastCompletedAt);
  return Number.isNaN(lastCompletedMs) || Date.now() - lastCompletedMs >= ONE_DAY_MS;
}

export function getEcsCatalogLastCompletedAt(): string | null {
  return getMeta(META_LAST_COMPLETED);
}

export function isEcsCatalogSyncRunning(): boolean {
  return Boolean(globalThis.__neoEcsCatalogSyncPromise);
}

export async function syncEcsFlavorCatalog(options: SyncOptions = {}) {
  if (globalThis.__neoEcsCatalogSyncPromise) {
    return globalThis.__neoEcsCatalogSyncPromise;
  }

  const execute = async () => {
    setMeta(META_LAST_STARTED, new Date().toISOString());
    setMeta(META_LAST_ERROR, null);

    const includeOnDemandBackfill = options.includeOnDemandBackfill ?? true;
    const onDemandBackfillLimit = Math.max(0, options.onDemandBackfillLimit ?? Number.POSITIVE_INFINITY);

    const discoveredRegions = await discoverCatalogRegions();
    const regions =
      options.regionIds && options.regionIds.length > 0
        ? options.regionIds.map((regionId) => {
            const discovered = discoveredRegions.find((candidate) => candidate.id === regionId);
            return {
              id: regionId,
              name: discovered?.name ?? getStoredRegionName(regionId),
            };
          })
        : discoveredRegions;

    for (const region of regions) {
      await syncSingleRegion(region.id, region.name, includeOnDemandBackfill, onDemandBackfillLimit);
    }

    const completedAt = new Date().toISOString();
    setMeta(META_LAST_COMPLETED, completedAt);
    if (!options.regionIds || options.regionIds.length === 0) {
      setMeta(META_LAST_FULL_COMPLETED, completedAt);
    }
  };

  globalThis.__neoEcsCatalogSyncPromise = execute()
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown ECS catalog sync error";
      setMeta(META_LAST_ERROR, message);
      throw error;
    })
    .finally(() => {
      globalThis.__neoEcsCatalogSyncPromise = undefined;
    });

  return globalThis.__neoEcsCatalogSyncPromise;
}

export function triggerBackgroundEcsCatalogRefresh() {
  if (!isFullRefreshStale() || globalThis.__neoEcsCatalogSyncPromise) {
    return;
  }

  void syncEcsFlavorCatalog({
    includeOnDemandBackfill: true,
  }).catch((error) => {
    console.error("ECS catalog refresh failed", error);
  });
}

export function startEcsCatalogAutoRefresh() {
  if (globalThis.__neoEcsCatalogIntervalStarted) {
    return;
  }

  globalThis.__neoEcsCatalogIntervalStarted = true;
  triggerBackgroundEcsCatalogRefresh();
  setInterval(() => {
    triggerBackgroundEcsCatalogRefresh();
  }, ONE_DAY_MS);
}

export async function ensureRegionCatalogAvailable(regionId: string) {
  if (getStoredFlavorCount(regionId) > 0) {
    triggerBackgroundEcsCatalogRefresh();
    return;
  }

  await syncEcsFlavorCatalog({
    regionIds: [regionId],
    includeOnDemandBackfill: false,
    force: true,
  });
  triggerBackgroundEcsCatalogRefresh();
}

export function listStoredEcsFlavors(regionId: string): StoredEcsFlavor[] {
  const flavors = db
    .query<FlavorRow, [string]>(
      `
        SELECT
          region_id,
          resource_spec_code,
          family,
          architecture,
          series,
          description,
          cpu,
          ram_gib,
          flavor_json,
          updated_at
        FROM ecs_flavor
        WHERE region_id = ?
        ORDER BY resource_spec_code ASC
      `,
    )
    .all(regionId);

  const prices = db
    .query<FlavorPriceRow, [string]>(
      `
        SELECT resource_spec_code, billing_mode, amount, currency
        FROM ecs_flavor_price
        WHERE region_id = ?
      `,
    )
    .all(regionId);

  const priceMap = new Map<string, { prices: Partial<Record<BillingMode, number>>; currency: string }>();
  for (const price of prices) {
    const current = priceMap.get(price.resource_spec_code) ?? {
      prices: {},
      currency: price.currency,
    };
    current.prices[price.billing_mode] = price.amount;
    current.currency = price.currency;
    priceMap.set(price.resource_spec_code, current);
  }

  return flavors.map((flavor) => {
    const priceInfo = priceMap.get(flavor.resource_spec_code);
    return {
      regionId: flavor.region_id,
      resourceSpecCode: flavor.resource_spec_code,
      family: flavor.family,
      architecture: flavor.architecture,
      series: flavor.series,
      description: flavor.description,
      cpu: flavor.cpu,
      ramGiB: flavor.ram_gib,
      prices: priceInfo?.prices ?? {},
      currency: priceInfo?.currency ?? DEFAULT_CURRENCY,
      updatedAt: flavor.updated_at,
    };
  });
}

