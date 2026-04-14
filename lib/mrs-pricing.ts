import type { MrsPricingCatalog } from "@/lib/mrs-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseMrsPricingCatalogResponse(body: unknown, regionId: string): MrsPricingCatalog {
  return parseDeclarativePricingCatalog<MrsPricingCatalog>(getDeclarativePricingDefinition("MRS"), body, regionId);
}

export async function fetchMrsPricingCatalog(regionId: string): Promise<MrsPricingCatalog> {
  return fetchDeclarativePricingCatalog<MrsPricingCatalog>(getDeclarativePricingDefinition("MRS"), regionId);
}
