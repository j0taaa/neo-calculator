import { getCatalogFetchFn } from "@/lib/catalog-fetch-registry";
import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { serviceCatalog } from "@/lib/service-config";
import { flexusLPlans } from "@/lib/flexus-l-catalog";
import { ensureRegionCatalogAvailable, getEcsCatalogLastCompletedAt, isEcsCatalogSyncRunning, listStoredEcsFlavors } from "@/lib/ecs-flavor-catalog";
import { fetchRegionSystemDiskPricing } from "@/lib/evs-disk-pricing";

export const revalidate = 3600;
export const runtime = "nodejs";

async function limitConcurrency<T>(tasks: (() => Promise<T>)[], maxConcurrent: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

async function fetchServiceCatalogDirect(
  serviceCode: string,
  regionKey: HuaweiRegionKey,
): Promise<unknown> {
  if (serviceCode === "ECS") {
    const catalogRegionId = getCatalogRegionId(regionKey);
    if (!catalogRegionId) return null;

    try {
      await ensureRegionCatalogAvailable(catalogRegionId);
      const diskPricing = await fetchRegionSystemDiskPricing(catalogRegionId);
      return {
        flavors: listStoredEcsFlavors(catalogRegionId),
        diskPricing,
        lastCompletedAt: getEcsCatalogLastCompletedAt(),
        syncing: isEcsCatalogSyncRunning(),
      };
    } catch {
      return null;
    }
  }

  const fetchFn = getCatalogFetchFn(serviceCode);
  if (!fetchFn) return null;

  const catalogRegionId = getCatalogRegionId(regionKey);
  if (!catalogRegionId) return null;

  try {
    return await fetchFn(catalogRegionId);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionsParam = searchParams.get("regions") || "";
  const selectedRegions = regionsParam
    .split(",")
    .filter((r): r is HuaweiRegionKey => r in huaweiRegions);

  if (selectedRegions.length === 0) {
    return Response.json(
      { error: "Please select at least one region" },
      { status: 400 },
    );
  }

  const tasks: Array<{
    service: (typeof serviceCatalog)[0];
    region: HuaweiRegionKey;
    task: () => Promise<unknown>;
  }> = [];

  for (const service of serviceCatalog) {
    for (const region of selectedRegions) {
      const serviceCode = service.code;
      const regionKey = region;
      tasks.push({
        service,
        region,
        task: () => fetchServiceCatalogDirect(serviceCode, regionKey),
      });
    }
  }

  const results = await limitConcurrency(
    tasks.map((t) => t.task),
    8,
  );

  const catalogsByService: Record<string, Record<string, unknown>> = {};

  for (let i = 0; i < tasks.length; i++) {
    const { service, region } = tasks[i];
    const result = results[i];
    if (result.status === "fulfilled" && result.value) {
      if (!catalogsByService[service.code]) {
        catalogsByService[service.code] = {};
      }
      catalogsByService[service.code][region] = result.value;
    }
  }

  return Response.json({
    regions: selectedRegions,
    catalogs: catalogsByService,
    flexusLPlans,
    generatedAt: new Date().toISOString(),
  });
}
