import type { GaussDbPricingCatalog } from "@/lib/gaussdb-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseGaussDbPricingCatalogResponse(body: unknown, regionId: string): GaussDbPricingCatalog {
  return parseDeclarativePricingCatalog<GaussDbPricingCatalog>(getDeclarativePricingDefinition("GaussDB"), body, regionId);
}

export async function fetchGaussDbPricingCatalog(regionId: string): Promise<GaussDbPricingCatalog> {
  return fetchDeclarativePricingCatalog<GaussDbPricingCatalog>(getDeclarativePricingDefinition("GaussDB"), regionId);
}
