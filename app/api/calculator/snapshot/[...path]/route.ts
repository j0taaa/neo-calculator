import { SnapshotStore } from "@/lib/huawei-snapshot/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" };
/** The runtime serves only Neo's published data model. Upstream UI assets are worker-only. */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.length !== 3 || path[1] !== "model") return Response.json({ error: "This calculator runtime resource has been removed" }, { status: 410, headers });
  try {
    const store = new SnapshotStore(), release = await store.release(path[0]);
    if (!release.engine) throw new Error("This release has no independently validated calculator model");
    const key = Object.keys(release.scopes).find(key => release.scopes[key] === path[2]);
    if (!key) throw new Error("Unknown synchronized calculator scope");
    const [service, region] = key.split("/"), scope = await store.scope(release, service, region, false);
    if (!scope.rules || !scope.rulesChecks) throw new Error("The independent calculator rules have not been verified");
    return Response.json({ release: release.id, scope: { ...scope, config: "" }, menu: JSON.parse(release.menu) }, { headers: { ...headers, "cache-control": "public, max-age=31536000, immutable" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Snapshot unavailable" }, { status: 503, headers: { ...headers, "cache-control": "no-store" } });
  }
}
