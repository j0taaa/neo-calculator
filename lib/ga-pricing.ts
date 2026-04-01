import type { GaPricingCatalog } from "@/lib/ga-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseGaPricingCatalogResponse(body: unknown, regionId: string): GaPricingCatalog {
  return parseDeclarativePricingCatalog<GaPricingCatalog>(getDeclarativePricingDefinition("GA"), body, regionId);
}

export async function fetchGaPricingCatalog(regionId = "global-cbc-1"): Promise<GaPricingCatalog> {
  return fetchDeclarativePricingCatalog<GaPricingCatalog>(getDeclarativePricingDefinition("GA"), regionId);
}
