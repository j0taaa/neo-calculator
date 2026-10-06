import { ecsCatalogScope } from "@/lib/calculator/server-directory";
import { ensureRegionCatalogAvailable, getEcsCatalogLastCompletedAt, isEcsCatalogSyncRunning, listStoredEcsFlavors } from "@/lib/ecs-flavor-catalog";
import { fetchRegionSystemDiskPricing } from "@/lib/evs-disk-pricing";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = await ecsCatalogScope(searchParams.get("region"));
  if (scope.error) return Response.json({ error: scope.error }, { status: scope.status });
  const { region: regionKey, catalogRegionId, label } = scope;

  if (!catalogRegionId) {
    return Response.json({
      region: regionKey,
      catalogRegionId: null,
      lastCompletedAt: getEcsCatalogLastCompletedAt(),
      syncing: isEcsCatalogSyncRunning(),
      flavors: [],
      error: `ECS catalog sync is not configured for ${label}.`,
    });
  }

  await ensureRegionCatalogAvailable(catalogRegionId);
  const diskPricing = await fetchRegionSystemDiskPricing(catalogRegionId);

  return Response.json({
    region: regionKey,
    catalogRegionId,
    lastCompletedAt: getEcsCatalogLastCompletedAt(),
    syncing: isEcsCatalogSyncRunning(),
    flavors: listStoredEcsFlavors(catalogRegionId),
    diskPricing,
  });
}
