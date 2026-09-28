import { getSyncStore } from "@/lib/huawei-sync/service";
import { ENGINE_VERSION } from "@/lib/huawei-sync/program";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getSyncStore();
  const releases = store.listReleases();
  return Response.json({ services: store.directory().map(service => ({ ...service,
    scopes: releases.filter(r => r.service.id === service.id && store.active(service.id, r.region)?.id === r.id).map(r => ({ region: r.region, releaseId: r.id, verifiedAt: r.verification?.checkedAt, cases: r.verification?.cases, billingMode: "Pay-per-use", available: service.available && r.engineVersion === ENGINE_VERSION && r.status === "active" && Date.now() - Date.parse(r.verification?.checkedAt ?? "1970") < 86400000 })),
    lastAttempt: releases.find(r => r.service.id === service.id)?.createdAt ?? null,
    diagnostics: releases.find(r => r.service.id === service.id)?.diagnostics ?? [],
  })) }, { headers: { "cache-control": "no-store" } });
}
