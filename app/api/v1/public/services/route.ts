import { calculatorDirectory } from "@/lib/calculator/server-directory";
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
  const directory = await calculatorDirectory();
  const services = calculatorServices(serviceCatalog, directory).map((s) => ({
    code: s.code,
    name: s.name,
    category: directory?.services.find(service => service.id === s.huaweiId)?.category ?? categoryMap[s.code.toLowerCase()] ?? "Other",
    pricingUrl: s.code.startsWith("HUAWEI:") ? "/api/calculator/native" : `/api/v1/public/catalog/${s.code}/pricing`,
    ...(s.huaweiId ? { calculator: { runtime: "huawei-native", serviceCode: `HUAWEI:${s.huaweiId}`,
      serviceId: s.huaweiId, sessionUrl: "/api/calculator/native", billingModes: directory?.billingModes[s.huaweiId] ?? {} } } : {}),
  }));

  return Response.json({ services, total: services.length });
}
