import type { NatPricingCatalog } from "@/lib/nat-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseNatPricingCatalogResponse(body: unknown, regionId: string): NatPricingCatalog {
  return parseDeclarativePricingCatalog<NatPricingCatalog>(getDeclarativePricingDefinition("NAT"), body, regionId);
}

export async function fetchNatPricingCatalog(regionId: string): Promise<NatPricingCatalog> {
  return fetchDeclarativePricingCatalog<NatPricingCatalog>(getDeclarativePricingDefinition("NAT"), regionId);
}
