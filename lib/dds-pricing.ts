import type { DdsPricingCatalog } from "@/lib/dds-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDdsPricingCatalogResponse(body: unknown, regionId: string): DdsPricingCatalog {
  return parseDeclarativePricingCatalog<DdsPricingCatalog>(getDeclarativePricingDefinition("DDS"), body, regionId);
}

export async function fetchDdsPricingCatalog(regionId: string): Promise<DdsPricingCatalog> {
  return fetchDeclarativePricingCatalog<DdsPricingCatalog>(getDeclarativePricingDefinition("DDS"), regionId);
}
