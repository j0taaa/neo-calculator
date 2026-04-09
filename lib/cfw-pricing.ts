import type { CfwPricingCatalog } from "@/lib/cfw-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseCfwPricingCatalogResponse(body: unknown, regionId: string): CfwPricingCatalog {
  return parseDeclarativePricingCatalog<CfwPricingCatalog>(getDeclarativePricingDefinition("CFW"), body, regionId);
}

export async function fetchCfwPricingCatalog(regionId: string): Promise<CfwPricingCatalog> {
  return fetchDeclarativePricingCatalog<CfwPricingCatalog>(getDeclarativePricingDefinition("CFW"), regionId);
}
