import type { DliPricingCatalog } from "@/lib/dli-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDliPricingCatalogResponse(body: unknown, regionId: string): DliPricingCatalog {
  return parseDeclarativePricingCatalog<DliPricingCatalog>(getDeclarativePricingDefinition("DLI"), body, regionId);
}

export async function fetchDliPricingCatalog(regionId: string): Promise<DliPricingCatalog> {
  return fetchDeclarativePricingCatalog<DliPricingCatalog>(getDeclarativePricingDefinition("DLI"), regionId);
}
