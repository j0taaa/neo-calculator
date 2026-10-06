import { calculatorDirectory } from "@/lib/calculator/server-directory";
import { huaweiRegions } from "@/lib/huawei-regions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const directory = await calculatorDirectory();
  const regions: { code: string; short: string; full: string; catalogRegionId: string | null; liveAvailable: boolean }[] = Object.entries(huaweiRegions).map(([key, data]) => ({
    code: key,
    short: data.short,
    full: data.full,
    catalogRegionId: data.catalogRegionId,
    liveAvailable: directory?.regions.some(region => region.id === data.catalogRegionId) ?? false,
  }));

  for (const region of directory?.regions ?? []) {
    if (!regions.some(existing => existing.catalogRegionId === region.id)) regions.push({ code: region.id,
      short: region.name, full: region.name, catalogRegionId: region.id, liveAvailable: true });
  }
  return Response.json({
    regions,
    total: regions.length,
  });
}