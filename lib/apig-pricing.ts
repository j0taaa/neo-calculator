import type { ApigPricingCatalog } from "@/lib/apig-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseApigPricingCatalogResponse(body: unknown, regionId: string): ApigPricingCatalog {
  return parseDeclarativePricingCatalog<ApigPricingCatalog>(getDeclarativePricingDefinition("APIG"), body, regionId);
}

export async function fetchApigPricingCatalog(regionId: string): Promise<ApigPricingCatalog> {
  return fetchDeclarativePricingCatalog<ApigPricingCatalog>(getDeclarativePricingDefinition("APIG"), regionId);
}
