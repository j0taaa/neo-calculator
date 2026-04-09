import type { CsePricingCatalog } from "@/lib/cse-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseCsePricingCatalogResponse(body: unknown, regionId: string): CsePricingCatalog {
  return parseDeclarativePricingCatalog<CsePricingCatalog>(getDeclarativePricingDefinition("CSE"), body, regionId);
}

export async function fetchCsePricingCatalog(regionId: string): Promise<CsePricingCatalog> {
  return fetchDeclarativePricingCatalog<CsePricingCatalog>(getDeclarativePricingDefinition("CSE"), regionId);
}
