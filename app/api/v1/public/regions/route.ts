import { SnapshotStore } from "@/lib/huawei-snapshot/store";
import { legacyRegion } from "@/lib/calculator/service-directory";
import { huaweiRegions } from "@/lib/huawei-regions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const release = await new SnapshotStore().active().catch(() => null);
  if (!release) return Response.json({ error: "The daily calculator snapshot is not available yet" }, { status: 503 });
  const regions = release.directory.regions.map(region => {
    const alias = legacyRegion(region.id);
    const legacy = alias ? huaweiRegions[alias as keyof typeof huaweiRegions] : undefined;
    return { id: region.id, code: alias ?? region.id, short: legacy?.short ?? region.name,
      full: legacy?.full ?? region.name, catalogRegionId: region.id, snapshotAvailable: true,
      liveAvailable: true }; // Retained for existing clients; availability now comes from the snapshot.
  });
  return Response.json({ regions, total: regions.length, releaseId: release.id }, { headers: { "cache-control": "no-store" } });
}
