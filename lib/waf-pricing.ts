import type { WafPricingCatalog } from "@/lib/waf-catalog";
import { fetchDeclarativePricingCatalog, parseDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";
import { getDeclarativePricingDefinition } from "@/lib/declarative-pricing-registry";

export function parseWafPricingCatalogResponse(body: unknown, regionId: string): WafPricingCatalog {
  return parseDeclarativePricingCatalog<WafPricingCatalog>(getDeclarativePricingDefinition("WAF"), body, regionId);
}

export async function fetchWafPricingCatalog(regionId: string): Promise<WafPricingCatalog> {
  return fetchDeclarativePricingCatalog<WafPricingCatalog>(getDeclarativePricingDefinition("WAF"), regionId);
}
