import type { RdsPricingCatalog } from "@/lib/rds-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseRdsPricingCatalogResponse(body: unknown, regionId: string): RdsPricingCatalog {
  return parseDeclarativePricingCatalog<RdsPricingCatalog>(getDeclarativePricingDefinition("RDS"), body, regionId);
}

export async function fetchRdsPricingCatalog(regionId: string): Promise<RdsPricingCatalog> {
  return fetchDeclarativePricingCatalog<RdsPricingCatalog>(getDeclarativePricingDefinition("RDS"), regionId);
}
