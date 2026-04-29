import { ensureRegionCatalogAvailable, listStoredEcsFlavors, type StoredEcsFlavor } from "@/lib/ecs-flavor-catalog";
import { flexusLPlans, type FlexusLPlan } from "@/lib/flexus-l-catalog";
import { getCatalogRegionId, huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";

export const runtime = "nodejs";

type SortField = "price" | "cpu" | "ram" | "name";
type SortOrder = "asc" | "desc";

function resolveSortField(value: string | null): SortField {
  switch (value) {
    case "price":
    case "hourlyPrice":
    case "monthlyPrice":
      return "price";
    case "cpu":
    case "ram":
    case "name":
      return value;
    default:
      return "price";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedRegion = searchParams.get("region") as HuaweiRegionKey | null;
  const regionKey = requestedRegion && requestedRegion in huaweiRegions ? requestedRegion : "la-sao-paulo1";
  const catalogRegionId = getCatalogRegionId(regionKey);

  if (!catalogRegionId) {
    return Response.json({ error: `Unknown region: ${regionKey}` }, { status: 400 });
  }

  const cpu = searchParams.get("cpu") ? Number(searchParams.get("cpu")) : undefined;
  const minCpu = searchParams.get("minCpu") ? Number(searchParams.get("minCpu")) : undefined;
  const maxCpu = searchParams.get("maxCpu") ? Number(searchParams.get("maxCpu")) : undefined;
  const ramGiB = searchParams.get("ramGiB") ? Number(searchParams.get("ramGiB")) : undefined;
  const minRamGiB = searchParams.get("minRamGiB") ? Number(searchParams.get("minRamGiB")) : undefined;
  const maxRamGiB = searchParams.get("maxRamGiB") ? Number(searchParams.get("maxRamGiB")) : undefined;
  const q = searchParams.get("q")?.trim().toLowerCase() || undefined;
  const billingMode = (searchParams.get("billingMode") || undefined) as keyof StoredEcsFlavor["prices"] | undefined;
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 500);
  const includeFlexusL = searchParams.get("includeFlexusL") === "1" || searchParams.get("includeFlexusL") === "true";
  const rawSort = searchParams.get("sort");
  const sortField = resolveSortField(rawSort);
  const sortOrder: SortOrder = (searchParams.get("order") as SortOrder) || "asc";

  await ensureRegionCatalogAvailable(catalogRegionId);
  let flavors = listStoredEcsFlavors(catalogRegionId);

  if (cpu) flavors = flavors.filter((f) => f.cpu === cpu);
  if (minCpu) flavors = flavors.filter((f) => f.cpu >= minCpu);
  if (maxCpu) flavors = flavors.filter((f) => f.cpu <= maxCpu);
  if (ramGiB) flavors = flavors.filter((f) => f.ramGiB === ramGiB);
  if (minRamGiB) flavors = flavors.filter((f) => f.ramGiB >= minRamGiB);
  if (maxRamGiB) flavors = flavors.filter((f) => f.ramGiB <= maxRamGiB);
  if (q) {
    flavors = flavors.filter((f) => {
      const text = `${f.resourceSpecCode} ${f.family ?? ""} ${f.architecture ?? ""} ${f.series ?? ""} ${f.description ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }
  if (billingMode) flavors = flavors.filter((f) => f.prices[billingMode] != null);

  const sortPriceMode = rawSort === "monthlyPrice"
    ? "MONTHLY"
    : billingMode ?? "ONDEMAND";

  flavors.sort((a, b) => {
    const mul = sortOrder === "asc" ? 1 : -1;
    switch (sortField) {
      case "price": {
        const pa = a.prices[sortPriceMode];
        const pb = b.prices[sortPriceMode];
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return mul * (pa - pb);
      }
      case "cpu":
        return mul * (a.cpu - b.cpu);
      case "ram":
        return mul * (a.ramGiB - b.ramGiB);
      case "name":
        return mul * a.resourceSpecCode.localeCompare(b.resourceSpecCode);
      default:
        return 0;
    }
  });

  flavors = flavors.slice(0, limit);

  type FlavorEntry = {
    productType: "ecs";
    resourceSpecCode: string;
    cpu: number;
    ramGiB: number;
    family: string | null;
    architecture: string | null;
    series: string | null;
    description: string | null;
    prices: Partial<Record<string, number>>;
    currency: string;
  };

  type FlexusLEntry = {
    productType: "flexus-l";
    planId: string;
    title: string;
    cpu: number;
    ramGiB: number;
    systemDiskGiB: number;
    peakBandwidthMbit: number;
    dataPackageTiB: number;
    monthlyPriceUsd: number;
    prices: { MONTHLY: number };
    currency: string;
  };

  const flavorEntries: FlavorEntry[] = flavors.map((f) => ({
    productType: "ecs",
    resourceSpecCode: f.resourceSpecCode,
    cpu: f.cpu,
    ramGiB: f.ramGiB,
    family: f.family,
    architecture: f.architecture,
    series: f.series,
    description: f.description,
    prices: f.prices,
    currency: f.currency,
  }));

  let flexusLEntries: FlexusLEntry[] = [];
  if (includeFlexusL) {
    let plans = [...flexusLPlans] as FlexusLPlan[];
    if (cpu) plans = plans.filter((p) => p.vcpu === cpu);
    if (minCpu) plans = plans.filter((p) => p.vcpu >= minCpu);
    if (maxCpu) plans = plans.filter((p) => p.vcpu <= maxCpu);
    if (ramGiB) plans = plans.filter((p) => p.ramGiB === ramGiB);
    if (minRamGiB) plans = plans.filter((p) => p.ramGiB >= minRamGiB);
    if (maxRamGiB) plans = plans.filter((p) => p.ramGiB <= maxRamGiB);
    if (q) {
      plans = plans.filter((p) => {
        const text = `${p.id} ${p.title} Flexus L`.toLowerCase();
        return text.includes(q!);
      });
    }

    flexusLEntries = plans.map((p) => ({
      productType: "flexus-l",
      planId: p.id,
      title: p.title,
      cpu: p.vcpu,
      ramGiB: p.ramGiB,
      systemDiskGiB: p.systemDiskGiB,
      peakBandwidthMbit: p.peakBandwidthMbit,
      dataPackageTiB: p.dataPackageTiB,
      monthlyPriceUsd: p.monthlyPriceUsd,
      prices: { MONTHLY: p.monthlyPriceUsd },
      currency: "USD",
    }));

    if (sortField === "price") {
      flexusLEntries.sort((a, b) => {
        const mul = sortOrder === "asc" ? 1 : -1;
        return mul * (a.monthlyPriceUsd - b.monthlyPriceUsd);
      });
    }
  }

  return Response.json({
    region: regionKey,
    catalogRegionId,
    ecsCount: flavorEntries.length,
    flexusLCount: flexusLEntries.length,
    flavors: flavorEntries,
    flexusLPlans: flexusLEntries,
  });
}
