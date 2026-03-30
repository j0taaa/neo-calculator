import type { DirectConnectPricingCatalog } from "@/lib/direct-connect-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDirectConnectPricingCatalogResponse(body: unknown, regionId: string): DirectConnectPricingCatalog {
  return parseDeclarativePricingCatalog<DirectConnectPricingCatalog>(getDeclarativePricingDefinition("DC"), body, regionId);
}

export async function fetchDirectConnectPricingCatalog(regionId: string): Promise<DirectConnectPricingCatalog> {
  return fetchDeclarativePricingCatalog<DirectConnectPricingCatalog>(getDeclarativePricingDefinition("DC"), regionId);
}
