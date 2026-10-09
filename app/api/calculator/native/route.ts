import { SnapshotStore } from "@/lib/huawei-snapshot/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
};
export async function GET() {
  try {
    const release = await new SnapshotStore().active();
    if (!release.engine) throw new Error("The independently validated daily calculator snapshot is not available yet");
    return Response.json(
      {
        ...release.directory,
        synchronizedAt: release.createdAt,
        releaseId: release.id,
        engine: release.engine,
        scopes: release.scopes,
      },
      { headers },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Snapshot unavailable",
      },
      { status: 503, headers },
    );
  }
}
export function POST() {
  return Response.json(
    {
      error:
        "Calculations run locally. Reopen the calculator to update this client.",
    },
    { status: 410, headers },
  );
}
