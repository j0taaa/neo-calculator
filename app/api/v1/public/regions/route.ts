import { huaweiRegions } from "@/lib/huawei-regions";

export const runtime = "nodejs";

export async function GET() {
  const regions = Object.entries(huaweiRegions).map(([key, data]) => ({
    code: key,
    short: data.short,
    full: data.full,
    catalogRegionId: data.catalogRegionId,
  }));

  return Response.json({
    regions,
    total: regions.length,
  });
}