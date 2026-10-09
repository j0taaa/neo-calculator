import { SnapshotStore } from "@/lib/huawei-snapshot/store";
import { apiService, calculatorApi, snapshotProductSchema } from "@/lib/calculator/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ serviceCode: string }> }) {
  const { serviceCode } = await context.params;
  const release = await new SnapshotStore().active().catch(() => null);
  if (!release) return Response.json({ error: "The daily calculator snapshot is not available yet" }, { status: 503 });
  const service = apiService(release.directory, serviceCode);
  if (!service) return Response.json({ error: "Unknown synchronized service" }, { status: 404 });
  const code = `HUAWEI:${service.id}`;
  return Response.json({ serviceCode: code, serviceName: service.name, productType: "huawei-native",
    releaseId: release.id, calculator: calculatorApi(release.directory, service.id), schema: snapshotProductSchema(code) },
    { headers: { "cache-control": "no-store" } });
}
