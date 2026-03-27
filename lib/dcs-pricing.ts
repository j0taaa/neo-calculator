import type { DcsPricingCatalog } from "@/lib/dcs-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseDcsPricingCatalogResponse(body: unknown, regionId: string): DcsPricingCatalog {
  return parseDeclarativePricingCatalog<DcsPricingCatalog>(getDeclarativePricingDefinition("DCS"), body, regionId);
}

export async function fetchDcsPricingCatalog(regionId: string): Promise<DcsPricingCatalog> {
  return fetchDeclarativePricingCatalog<DcsPricingCatalog>(getDeclarativePricingDefinition("DCS"), regionId);
}
