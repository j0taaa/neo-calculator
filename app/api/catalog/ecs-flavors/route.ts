import { ensureRegionCatalogAvailable, getEcsCatalogLastCompletedAt, isEcsCatalogSyncRunning, listStoredEcsFlavors } from "@/lib/ecs-flavor-catalog";
import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
  const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
  const catalogRegionId = getCatalogRegionId(regionKey);

  if (!catalogRegionId) {
    return Response.json({
      region: regionKey,
      catalogRegionId: null,
      lastCompletedAt: getEcsCatalogLastCompletedAt(),
      syncing: isEcsCatalogSyncRunning(),
      flavors: [],
      error: `ECS catalog sync is not configured for ${huaweiRegions[regionKey].short}.`,
    });
  }

  await ensureRegionCatalogAvailable(catalogRegionId);

  return Response.json({
    region: regionKey,
    catalogRegionId,
    lastCompletedAt: getEcsCatalogLastCompletedAt(),
    syncing: isEcsCatalogSyncRunning(),
    flavors: listStoredEcsFlavors(catalogRegionId),
  });
}
