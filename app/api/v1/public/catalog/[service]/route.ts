import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const runtime = "nodejs";

const regionToCatalogId: Partial<Record<HuaweiRegionKey, string>> = {
  "la-sao-paulo1": "sa-brazil-1",
  "la-santiago": "la-south-2",
  "cn-hong-kong": "ap-southeast-1",
  "ap-bangkok": "ap-southeast-2",
  "ap-singapore": "ap-southeast-3",
  "ap-jakarta": "ap-southeast-4",
  "ap-manila": "ap-southeast-5",
  "ap-kuala-lumpur-op6": "my-kualalumpur-1",
  "cn-north-beijing4": "cn-north-4",
  "cn-north3": "cn-north-12",
  "cn-east-shanghai1": "cn-east-3",
  "cn-east-qingdao": "cn-east-5",
  "cn-east2": "cn-east-4",
  "cn-south-guangzhou": "cn-south-1",
  "cn-southwest-guiyang1": "cn-southwest-2",
  "me-riyadh": "me-east-1",
  "af-johannesburg": "af-south-1",
  "af-cairo": "af-north-1",
  "eu-paris": "eu-west-0",
  "eu-dublin": "eu-west-101",
  "tr-istanbul": "tr-west-1",
  "la-mexico-city1": "na-mexico-1",
  "la-mexico-city2": "la-north-2",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ service: string }> },
) {
  const { service } = await context.params;
  const { searchParams } = new URL(request.url);
  const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
  const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
  const catalogRegionId = regionToCatalogId[regionKey];

  if (!catalogRegionId) {
    return Response.json(
      {
        region: regionKey,
        catalogRegionId: null,
        catalog: null,
        error: `${service} pricing is not configured for ${huaweiRegions[regionKey].short}.`,
      },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(
    `${baseUrl}/api/catalog/${service}-pricing?region=${regionKey}`,
    {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) {
    return Response.json(
      {
        service,
        region: regionKey,
        catalogRegionId: null,
        catalog: null,
        error: `Failed to fetch ${service} pricing: ${response.statusText}`,
      },
      { status: response.status },
    );
  }

  const data = await response.json();
  return Response.json({
    service,
    region: regionKey,
    catalogRegionId,
    catalog: data.catalog,
  });
}