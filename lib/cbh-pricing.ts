import type { CbhPricingCatalog } from "@/lib/cbh-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseCbhPricingCatalogResponse(body: unknown, regionId: string): CbhPricingCatalog {
  return parseDeclarativePricingCatalog<CbhPricingCatalog>(getDeclarativePricingDefinition("CBH"), body, regionId);
}

export async function fetchCbhPricingCatalog(regionId: string): Promise<CbhPricingCatalog> {
  return fetchDeclarativePricingCatalog<CbhPricingCatalog>(getDeclarativePricingDefinition("CBH"), regionId);
}
