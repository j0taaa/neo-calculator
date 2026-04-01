import type { VpcepPricingCatalog } from "@/lib/vpcep-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseVpcepPricingCatalogResponse(body: unknown, regionId: string): VpcepPricingCatalog {
  return parseDeclarativePricingCatalog<VpcepPricingCatalog>(getDeclarativePricingDefinition("VPCEP"), body, regionId);
}

export async function fetchVpcepPricingCatalog(regionId: string): Promise<VpcepPricingCatalog> {
  return fetchDeclarativePricingCatalog<VpcepPricingCatalog>(getDeclarativePricingDefinition("VPCEP"), regionId);
}
