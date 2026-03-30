import type { FlexusRdsPricingCatalog } from "@/lib/flexus-rds-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseFlexusRdsPricingCatalogResponse(body: unknown, regionId: string): FlexusRdsPricingCatalog {
  return parseDeclarativePricingCatalog<FlexusRdsPricingCatalog>(getDeclarativePricingDefinition("Flexus RDS"), body, regionId);
}

export async function fetchFlexusRdsPricingCatalog(regionId: string): Promise<FlexusRdsPricingCatalog> {
  return fetchDeclarativePricingCatalog<FlexusRdsPricingCatalog>(getDeclarativePricingDefinition("Flexus RDS"), regionId);
}
