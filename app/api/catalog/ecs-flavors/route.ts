import { nativeRegion } from "@/lib/calculator/service-directory";
import { SnapshotStore } from "@/lib/huawei-snapshot/store";
import { snapshotFlavors } from "@/lib/huawei-snapshot/flavors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = params.get("region") ?? "la-sao-paulo1",
    region = nativeRegion(requested);
  try {
    const store = new SnapshotStore(),
      release = params.get("release")
        ? await store.release(params.get("release")!)
        : await store.active(),
      scope = await store.scope(release, "ecs", region, false);
    return Response.json(
      {
        region: requested,
        catalogRegionId: region,
        lastCompletedAt: scope.verifiedAt,
        syncing: false,
        flavors: snapshotFlavors(scope, params.get("locationCode") ?? ""),
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Snapshot unavailable",
      },
      { status: 503 },
    );
  }
}
