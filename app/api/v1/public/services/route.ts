import { SnapshotStore } from "@/lib/huawei-snapshot/store";
import { calculatorApi } from "@/lib/calculator/api";
import { calculatorServices } from "@/lib/calculator/service-directory";
import { serviceCatalog } from "@/lib/service-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const categoryMap: Record<string, string> = {
  apig: "Networking",
  cce: "Compute",
  ccm: "Video",
  cbr: "Storage",
  cbh: "Security",
  dcs: "Database",
  dc: "Networking",
  dms: "Middleware",
  eip: "Networking",
  elb: "Networking",
  er: "Networking",
  evs: "Storage",
  "flexus-rds": "Database",
  functiongraph: "Compute",
  ga: "Networking",
  lts: "Management",
  modelarts: "AI",
  nat: "Networking",
  obs: "Storage",
  rds: "Database",
  sfs: "Storage",
  sfsturbo: "Storage",
  vpcep: "Networking",
  vpn: "Networking",
  workspace: "Desktop",
  ges: "Database",
  cse: "Middleware",
  dis: "Analytics",
  hss: "Security",
  dew: "Security",
  smn: "Application",
  dws: "Database",
  dli: "Analytics",
  cdm: "Migration",
  dds: "Database",
  waf: "Security",
  cfw: "Security",
};

export async function GET() {
  const release = await new SnapshotStore().active().catch(() => null);
  if (!release) return Response.json({ error: "The daily calculator snapshot is not available yet" }, { status: 503 });
  const directory = release.directory;
  const services = calculatorServices(serviceCatalog, directory).filter(s => s.huaweiId).map((s) => ({
    code: s.code,
    name: s.name,
    category: directory?.services.find(service => service.id === s.huaweiId)?.category ?? categoryMap[s.code.toLowerCase()] ?? "Other",
    pricingUrl: "/api/v1/calculate",
    pricingMethod: "POST",
    schemaUrl: `/api/v1/public/services/${encodeURIComponent(s.code)}/schema`,
    calculator: calculatorApi(directory, s.huaweiId!),
  }));

  return Response.json({ services, total: services.length, releaseId: release.id }, { headers: { "cache-control": "no-store" } });
}
