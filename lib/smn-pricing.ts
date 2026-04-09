import type { SmnPricingCatalog } from "@/lib/smn-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseSmnPricingCatalogResponse(body: unknown, regionId: string): SmnPricingCatalog {
  return parseDeclarativePricingCatalog<SmnPricingCatalog>(getDeclarativePricingDefinition("SMN"), body, regionId);
}

export async function fetchSmnPricingCatalog(regionId: string): Promise<SmnPricingCatalog> {
  return fetchDeclarativePricingCatalog<SmnPricingCatalog>(getDeclarativePricingDefinition("SMN"), regionId);
}
