import { serviceCatalog } from "@/lib/service-config";

export const revalidate = 3600;
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
  const services = serviceCatalog.map((s) => ({
    code: s.code,
    name: s.name,
    category: categoryMap[s.code] ?? "Other",
    pricingUrl: `/api/v1/public/catalog/${s.code}/pricing`,
  }));

  return Response.json({ services, total: services.length });
}
