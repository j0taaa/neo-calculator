import type { SfsTurboPricingCatalog } from "@/lib/sfs-turbo-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseSfsTurboPricingCatalogResponse(body: unknown, regionId: string): SfsTurboPricingCatalog {
  return parseDeclarativePricingCatalog<SfsTurboPricingCatalog>(getDeclarativePricingDefinition("SFS Turbo"), body, regionId);
}

export async function fetchSfsTurboPricingCatalog(regionId: string): Promise<SfsTurboPricingCatalog> {
  return fetchDeclarativePricingCatalog<SfsTurboPricingCatalog>(getDeclarativePricingDefinition("SFS Turbo"), regionId);
}
