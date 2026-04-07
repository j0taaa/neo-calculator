import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { serviceCatalog } from "@/lib/service-config";

export const runtime = "nodejs";

// Map of service codes to their API route names
const serviceApiMap: Record<string, string> = {
  VPN: "vpn-pricing",
  ECS: "ecs-flavors",
  CCE: "cce-pricing",
  CCM: "ccm-pricing",
  CBR: "cbr-pricing",
  CBH: "cbh-pricing",
  DCS: "dcs-pricing",
  DC: "direct-connect-pricing",
  EIP: "eip-pricing",
  ELB: "elb-pricing",
  ER: "er-pricing",
  EVS: "evs-pricing",
  "Flexus RDS": "flexus-rds-pricing",
  FunctionGraph: "functiongraph-pricing",
  GA: "ga-pricing",
  LTS: "lts-pricing",
  ModelArts: "modelarts-pricing",
  NAT: "nat-pricing",
  OBS: "obs-pricing",
  RDS: "rds-pricing",
  SFS: "sfs-pricing",
  "SFS Turbo": "sfs-turbo-pricing",
  VPC: "vpcep-pricing",
  Workspace: "workspace-pricing",
  APIG: "apig-pricing",
};

// Fetch catalog for a service in a region
async function fetchServiceCatalog(
  serviceCode: string,
  regionKey: HuaweiRegionKey,
  baseUrl: string,
): Promise<unknown> {
  const apiName = serviceApiMap[serviceCode];
  if (!apiName) {
    return null;
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/catalog/${apiName}?region=${regionKey}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.catalog;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regionsParam = searchParams.get("regions") || "";
  const selectedRegions = regionsParam
    .split(",")
    .filter((r): r is HuaweiRegionKey => r in huaweiRegions);

  if (selectedRegions.length === 0) {
    return Response.json(
      { error: "Please select at least one region" },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? `${new URL(request.url).origin}`;

  // Fetch all catalogs for all selected regions in parallel
  const catalogPromises: Array<{
    service: (typeof serviceCatalog)[0];
    region: HuaweiRegionKey;
    promise: Promise<unknown>;
  }> = [];

  for (const service of serviceCatalog) {
    for (const region of selectedRegions) {
      catalogPromises.push({
        service,
        region,
        promise: fetchServiceCatalog(service.code, region, baseUrl),
      });
    }
  }

  const results = await Promise.allSettled(
    catalogPromises.map((cp) => cp.promise),
  );

  // Organize results by service and region
  const catalogsByService: Record<
    string,
    Record<string, unknown>
  > = {};

  for (let i = 0; i < catalogPromises.length; i++) {
    const { service, region } = catalogPromises[i];
    const result = results[i];
    if (result.status === "fulfilled" && result.value) {
      if (!catalogsByService[service.code]) {
        catalogsByService[service.code] = {};
      }
      catalogsByService[service.code][region] = result.value;
    }
  }

  return Response.json({
    regions: selectedRegions,
    catalogs: catalogsByService,
    generatedAt: new Date().toISOString(),
  });
}