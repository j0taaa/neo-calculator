import { getCatalogFetchFn } from "@/lib/catalog-fetch-registry";
import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ service: string }> },
) {
  const { service } = await context.params;
  const { searchParams } = new URL(request.url);
  const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
  const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
  const catalogRegionId = getCatalogRegionId(regionKey);

  if (!catalogRegionId) {
    return Response.json(
      {
        service,
        region: regionKey,
        catalogRegionId: null,
        catalog: null,
        error: `${service} pricing is not configured for ${huaweiRegions[regionKey].short}.`,
      },
      { status: 400 },
    );
  }

  const fetchFn = getCatalogFetchFn(service);
  if (!fetchFn) {
    return Response.json(
      {
        service,
        region: regionKey,
        catalogRegionId,
        catalog: null,
        error: `Unknown service: ${service}`,
      },
      { status: 404 },
    );
  }

  const catalog = await fetchFn(catalogRegionId);

  return Response.json({
    service,
    region: regionKey,
    catalogRegionId,
    catalog,
  });
}
