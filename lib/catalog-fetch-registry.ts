import { fetchCcePricingCatalog } from "@/lib/cce-pricing";
import { fetchElbPricingCatalog } from "@/lib/elb-pricing";
import { fetchFunctionGraphPricingCatalog } from "@/lib/functiongraph-pricing";
import { fetchModelArtsPricingCatalog } from "@/lib/modelarts-pricing";
import { fetchObsPricingCatalog } from "@/lib/obs-pricing";
import { fetchVpnPricingCatalog } from "@/lib/vpn-pricing";
import { fetchWorkspacePricingCatalog } from "@/lib/workspace-pricing";
import { fetchRegionSystemDiskPricing } from "@/lib/evs-disk-pricing";
import { serviceBundles } from "@/config/services/bundles";
import { fetchDeclarativePricingCatalog } from "@/lib/declarative-pricing-engine";

type CatalogFetchFn = (regionId: string) => Promise<unknown>;

// Only catalogs with a custom Huawei response shape need an adapter here.
const catalogFetchMap: Record<string, CatalogFetchFn> = {
  CCE: fetchCcePricingCatalog,
  ELB: fetchElbPricingCatalog,
  OBS: fetchObsPricingCatalog,
  ModelArts: fetchModelArtsPricingCatalog,
  VPN: fetchVpnPricingCatalog,
  Workspace: fetchWorkspacePricingCatalog,
  FunctionGraph: fetchFunctionGraphPricingCatalog,
  EVS: fetchRegionSystemDiskPricing,
};

for (const bundle of serviceBundles) {
  const definition = bundle.catalogDefinition;
  if (definition) {
    catalogFetchMap[bundle.service.serviceCode] = (regionId) => fetchDeclarativePricingCatalog(definition, regionId);
  }
}

export function getCatalogFetchFn(serviceCode: string): CatalogFetchFn | undefined {
  return catalogFetchMap[serviceCode];
}
