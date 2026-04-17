import { ensureRegionCatalogAvailable, listStoredEcsFlavors, type StoredEcsFlavor } from "@/lib/ecs-flavor-catalog";
import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
  const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
  const catalogRegionId = getCatalogRegionId(regionKey);

  if (!catalogRegionId) {
    return Response.json({ error: `Unknown region: ${regionKey}` }, { status: 400 });
  }

  const cpu = searchParams.get("cpu") ? Number(searchParams.get("cpu")) : undefined;
  const ramGiB = searchParams.get("ramGiB") ? Number(searchParams.get("ramGiB")) : undefined;
  const q = searchParams.get("q")?.trim().toLowerCase() || undefined;
  const billingMode = searchParams.get("billingMode") || undefined;
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 500);

  await ensureRegionCatalogAvailable(catalogRegionId);
  let flavors = listStoredEcsFlavors(catalogRegionId);

  if (cpu) flavors = flavors.filter((f) => f.cpu === cpu);
  if (ramGiB) flavors = flavors.filter((f) => f.ramGiB === ramGiB);
  if (q) {
    flavors = flavors.filter((f) => {
      const text = `${f.resourceSpecCode} ${f.family ?? ""} ${f.architecture ?? ""} ${f.series ?? ""} ${f.description ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }
  if (billingMode) flavors = flavors.filter((f) => f.prices[billingMode as keyof StoredEcsFlavor["prices"]] != null);

  flavors = flavors.slice(0, limit);

  return Response.json({
    region: regionKey,
    catalogRegionId,
    count: flavors.length,
    flavors: flavors.map((f) => ({
      resourceSpecCode: f.resourceSpecCode,
      cpu: f.cpu,
      ramGiB: f.ramGiB,
      family: f.family,
      architecture: f.architecture,
      series: f.series,
      description: f.description,
      prices: f.prices,
      currency: f.currency,
    })),
  });
}
