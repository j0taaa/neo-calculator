import type { CcmPricingCatalog } from "@/lib/ccm-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseCcmPricingCatalogResponse(body: unknown, regionId: string): CcmPricingCatalog {
  return parseDeclarativePricingCatalog<CcmPricingCatalog>(getDeclarativePricingDefinition("CCM"), body, regionId);
}

export async function fetchCcmPricingCatalog(regionId: string): Promise<CcmPricingCatalog> {
  return fetchDeclarativePricingCatalog<CcmPricingCatalog>(getDeclarativePricingDefinition("CCM"), regionId);
}
