import type { DmsPricingCatalog } from "@/lib/dms-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDmsPricingCatalogResponse(body: unknown, regionId: string): DmsPricingCatalog {
  return parseDeclarativePricingCatalog<DmsPricingCatalog>(getDeclarativePricingDefinition("DMS"), body, regionId);
}

export async function fetchDmsPricingCatalog(regionId: string): Promise<DmsPricingCatalog> {
  return fetchDeclarativePricingCatalog<DmsPricingCatalog>(getDeclarativePricingDefinition("DMS"), regionId);
}
