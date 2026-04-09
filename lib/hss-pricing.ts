import type { HssPricingCatalog } from "@/lib/hss-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseHssPricingCatalogResponse(body: unknown, regionId: string): HssPricingCatalog {
  return parseDeclarativePricingCatalog<HssPricingCatalog>(getDeclarativePricingDefinition("HSS"), body, regionId);
}

export async function fetchHssPricingCatalog(regionId: string): Promise<HssPricingCatalog> {
  return fetchDeclarativePricingCatalog<HssPricingCatalog>(getDeclarativePricingDefinition("HSS"), regionId);
}
