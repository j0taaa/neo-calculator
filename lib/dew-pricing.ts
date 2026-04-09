import type { DewPricingCatalog } from "@/lib/dew-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDewPricingCatalogResponse(body: unknown, regionId: string): DewPricingCatalog {
  return parseDeclarativePricingCatalog<DewPricingCatalog>(getDeclarativePricingDefinition("DEW"), body, regionId);
}

export async function fetchDewPricingCatalog(regionId: string): Promise<DewPricingCatalog> {
  return fetchDeclarativePricingCatalog<DewPricingCatalog>(getDeclarativePricingDefinition("DEW"), regionId);
}
