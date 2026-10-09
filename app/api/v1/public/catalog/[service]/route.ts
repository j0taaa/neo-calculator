import { SnapshotStore } from "@/lib/huawei-snapshot/store";
import { apiService } from "@/lib/calculator/api";
import { nativeRegion } from "@/lib/calculator/service-directory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ service: string }> }) {
  const { service: code } = await context.params;
  const store = new SnapshotStore();
  const release = await store.active().catch(() => null);
  if (!release) return Response.json({ error: "The daily calculator snapshot is not available yet" }, { status: 503 });
  const service = apiService(release.directory, code);
  if (!service) return Response.json({ error: "Unknown synchronized service" }, { status: 404 });
  const modes = release.directory.billingModes[service.id] ?? {};
  const requested = new URL(request.url).searchParams.get("region");
  const region = requested === null ? Object.keys(modes).find(region => modes[region]?.length) : nativeRegion(requested);
  if (!region || !release.directory.regions.some(entry => entry.id === region))
    return Response.json({ error: "Unknown region" }, { status: 400 });
  if (!modes[region]?.length)
    return Response.json({ error: "This service is unavailable in the requested region" }, { status: 422 });
  try {
    const scope = await store.scope(release, service.id, region, false);
    return Response.json({ service: code, serviceCode: `HUAWEI:${service.id}`, region, catalogRegionId: region,
      releaseId: release.id, synchronizedAt: release.createdAt, billingModes: scope.modes,
      catalog: scope.products.product, configuration: scope.config, source: scope.source },
      { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The synchronized catalog is unavailable" }, { status: 503 });
  }
}
