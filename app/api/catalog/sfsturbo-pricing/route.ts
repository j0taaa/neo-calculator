import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { fetchSfsTurboPricingCatalog } from "@/lib/sfs-turbo-pricing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
  const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
  const catalogRegionId = getCatalogRegionId(regionKey);

  if (!catalogRegionId) {
    return Response.json(
      {
        region: regionKey,
        catalogRegionId: null,
        catalog: null,
        error: `Scalable File Service Turbo pricing is not configured for ${huaweiRegions[regionKey].short}.`,
      },
      { status: 400 },
    );
  }

  try {
    const catalog = await fetchSfsTurboPricingCatalog(catalogRegionId);

    return Response.json({
      region: regionKey,
      catalogRegionId,
      catalog,
    });
  } catch (error) {
    return Response.json(
      {
        region: regionKey,
        catalogRegionId,
        catalog: null,
        error: error instanceof Error ? error.message : "Failed to load Scalable File Service Turbo pricing.",
      },
      { status: 502 },
    );
  }
}
