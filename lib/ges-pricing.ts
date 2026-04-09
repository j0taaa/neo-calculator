import type { GesPricingCatalog } from "@/lib/ges-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseGesPricingCatalogResponse(body: unknown, regionId: string): GesPricingCatalog {
  return parseDeclarativePricingCatalog<GesPricingCatalog>(getDeclarativePricingDefinition("GES"), body, regionId);
}

export async function fetchGesPricingCatalog(regionId: string): Promise<GesPricingCatalog> {
  return fetchDeclarativePricingCatalog<GesPricingCatalog>(getDeclarativePricingDefinition("GES"), regionId);
}
