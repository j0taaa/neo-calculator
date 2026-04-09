import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { fetchCdmPricingCatalog } from "@/lib/cdm-pricing";

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
        error: `CDM pricing is not configured for ${huaweiRegions[regionKey].short}.`,
      },
      { status: 400 },
    );
  }

  const catalog = await fetchCdmPricingCatalog(catalogRegionId);

  return Response.json({
    region: regionKey,
    catalogRegionId,
    catalog,
  });
}
