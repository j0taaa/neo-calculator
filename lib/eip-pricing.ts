import type { EipPricingCatalog } from "@/lib/eip-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseEipPricingCatalogResponse(body: unknown, regionId: string): EipPricingCatalog {
  return parseDeclarativePricingCatalog<EipPricingCatalog>(getDeclarativePricingDefinition("EIP"), body, regionId);
}

export async function fetchEipPricingCatalog(regionId: string): Promise<EipPricingCatalog> {
  return fetchDeclarativePricingCatalog<EipPricingCatalog>(getDeclarativePricingDefinition("EIP"), regionId);
}
