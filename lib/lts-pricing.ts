import type { LtsPricingCatalog } from "@/lib/lts-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseLtsPricingCatalogResponse(body: unknown, regionId: string): LtsPricingCatalog {
  return parseDeclarativePricingCatalog<LtsPricingCatalog>(getDeclarativePricingDefinition("LTS"), body, regionId);
}

export async function fetchLtsPricingCatalog(regionId: string): Promise<LtsPricingCatalog> {
  return fetchDeclarativePricingCatalog<LtsPricingCatalog>(getDeclarativePricingDefinition("LTS"), regionId);
}
