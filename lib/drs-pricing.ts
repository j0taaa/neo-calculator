import type { DrsPricingCatalog } from "@/lib/drs-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDrsPricingCatalogResponse(body: unknown, regionId: string): DrsPricingCatalog {
  return parseDeclarativePricingCatalog<DrsPricingCatalog>(getDeclarativePricingDefinition("DRS"), body, regionId);
}

export async function fetchDrsPricingCatalog(regionId: string): Promise<DrsPricingCatalog> {
  return fetchDeclarativePricingCatalog<DrsPricingCatalog>(getDeclarativePricingDefinition("DRS"), regionId);
}
