import type { CdmPricingCatalog } from "@/lib/cdm-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseCdmPricingCatalogResponse(body: unknown, regionId: string): CdmPricingCatalog {
  return parseDeclarativePricingCatalog<CdmPricingCatalog>(getDeclarativePricingDefinition("CDM"), body, regionId);
}

export async function fetchCdmPricingCatalog(regionId: string): Promise<CdmPricingCatalog> {
  return fetchDeclarativePricingCatalog<CdmPricingCatalog>(getDeclarativePricingDefinition("CDM"), regionId);
}
