import type { ErPricingCatalog } from "@/lib/er-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseErPricingCatalogResponse(body: unknown, regionId: string): ErPricingCatalog {
  return parseDeclarativePricingCatalog<ErPricingCatalog>(getDeclarativePricingDefinition("ER"), body, regionId);
}

export async function fetchErPricingCatalog(regionId: string): Promise<ErPricingCatalog> {
  return fetchDeclarativePricingCatalog<ErPricingCatalog>(getDeclarativePricingDefinition("ER"), regionId);
}
