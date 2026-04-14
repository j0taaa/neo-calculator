import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { fetchGaPricingCatalog } from "@/lib/ga-pricing";

export const revalidate = 300;
export const runtime = "nodejs";

const GLOBAL_ACCELERATOR_REGION = "global-cbc-1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
  const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
  const catalog = await fetchGaPricingCatalog(GLOBAL_ACCELERATOR_REGION);

  return Response.json({
    region: regionKey,
    catalogRegionId: GLOBAL_ACCELERATOR_REGION,
    catalog,
  });
}
