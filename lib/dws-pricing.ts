import type { DwsPricingCatalog } from "@/lib/dws-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDwsPricingCatalogResponse(body: unknown, regionId: string): DwsPricingCatalog {
  return parseDeclarativePricingCatalog<DwsPricingCatalog>(getDeclarativePricingDefinition("DWS"), body, regionId);
}

export async function fetchDwsPricingCatalog(regionId: string): Promise<DwsPricingCatalog> {
  return fetchDeclarativePricingCatalog<DwsPricingCatalog>(getDeclarativePricingDefinition("DWS"), regionId);
}
