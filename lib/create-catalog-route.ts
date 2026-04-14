import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

type CatalogRouteOptions = {
  serviceName: string;
  responseKey?: string;
  wrapWithErrorHandler?: boolean;
};

export function createCatalogRoute(
  fetchFn: (regionId: string) => Promise<unknown>,
  options: CatalogRouteOptions,
) {
  const { serviceName, responseKey = "catalog", wrapWithErrorHandler = false } = options;

  return async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
    const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
    const catalogRegionId = getCatalogRegionId(regionKey);

    if (!catalogRegionId) {
      return Response.json(
        {
          region: regionKey,
          catalogRegionId: null,
          [responseKey]: null,
          error: `${serviceName} pricing is not configured for ${huaweiRegions[regionKey].short}.`,
        },
        { status: 400 },
      );
    }

    if (wrapWithErrorHandler) {
      try {
        const data = await fetchFn(catalogRegionId);
        return Response.json({ region: regionKey, catalogRegionId, [responseKey]: data });
      } catch (error) {
        return Response.json(
          {
            region: regionKey,
            catalogRegionId,
            [responseKey]: null,
            error: error instanceof Error ? error.message : `Failed to load ${serviceName} pricing.`,
          },
          { status: 502 },
        );
      }
    }

    const data = await fetchFn(catalogRegionId);

    return Response.json({
      region: regionKey,
      catalogRegionId,
      [responseKey]: data,
    });
  };
}
