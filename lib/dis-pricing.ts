import type { DisPricingCatalog } from "@/lib/dis-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDisPricingCatalogResponse(body: unknown, regionId: string): DisPricingCatalog {
  return parseDeclarativePricingCatalog<DisPricingCatalog>(getDeclarativePricingDefinition("DIS"), body, regionId);
}

export async function fetchDisPricingCatalog(regionId: string): Promise<DisPricingCatalog> {
  return fetchDeclarativePricingCatalog<DisPricingCatalog>(getDeclarativePricingDefinition("DIS"), regionId);
}
