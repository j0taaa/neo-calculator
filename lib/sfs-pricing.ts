import type { SfsPricingCatalog } from "@/lib/sfs-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseSfsPricingCatalogResponse(body: unknown, regionId: string): SfsPricingCatalog {
  return parseDeclarativePricingCatalog<SfsPricingCatalog>(getDeclarativePricingDefinition("SFS"), body, regionId);
}

export async function fetchSfsPricingCatalog(regionId: string): Promise<SfsPricingCatalog> {
  return fetchDeclarativePricingCatalog<SfsPricingCatalog>(getDeclarativePricingDefinition("SFS"), regionId);
}

