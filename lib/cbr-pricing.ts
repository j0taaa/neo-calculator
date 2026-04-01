import type { CbrPricingCatalog } from "@/lib/cbr-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseCbrPricingCatalogResponse(body: unknown, regionId: string): CbrPricingCatalog {
  return parseDeclarativePricingCatalog<CbrPricingCatalog>(getDeclarativePricingDefinition("CBR"), body, regionId);
}

export async function fetchCbrPricingCatalog(regionId: string): Promise<CbrPricingCatalog> {
  return fetchDeclarativePricingCatalog<CbrPricingCatalog>(getDeclarativePricingDefinition("CBR"), regionId);
}

