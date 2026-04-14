import { fetchApigPricingCatalog } from "@/lib/apig-pricing";
import { fetchCbrPricingCatalog } from "@/lib/cbr-pricing";
import { fetchCcePricingCatalog } from "@/lib/cce-pricing";
import { fetchCcmPricingCatalog } from "@/lib/ccm-pricing";
import { fetchCbhPricingCatalog } from "@/lib/cbh-pricing";
import { fetchCfwPricingCatalog } from "@/lib/cfw-pricing";
import { fetchCdmPricingCatalog } from "@/lib/cdm-pricing";
import { fetchCsePricingCatalog } from "@/lib/cse-pricing";
import { fetchDcsPricingCatalog } from "@/lib/dcs-pricing";
import { fetchDdsPricingCatalog } from "@/lib/dds-pricing";
import { fetchDewPricingCatalog } from "@/lib/dew-pricing";
import { fetchDirectConnectPricingCatalog } from "@/lib/direct-connect-pricing";
import { fetchDisPricingCatalog } from "@/lib/dis-pricing";
import { fetchDliPricingCatalog } from "@/lib/dli-pricing";
import { fetchDmsPricingCatalog } from "@/lib/dms-pricing";
import { fetchDrsPricingCatalog } from "@/lib/drs-pricing";
import { fetchMrsPricingCatalog } from "@/lib/mrs-pricing";
import { fetchDwsPricingCatalog } from "@/lib/dws-pricing";
import { fetchElbPricingCatalog } from "@/lib/elb-pricing";
import { fetchEipPricingCatalog } from "@/lib/eip-pricing";
import { fetchErPricingCatalog } from "@/lib/er-pricing";
import { fetchFlexusRdsPricingCatalog } from "@/lib/flexus-rds-pricing";
import { fetchFunctionGraphPricingCatalog } from "@/lib/functiongraph-pricing";
import { fetchGaPricingCatalog } from "@/lib/ga-pricing";
import { fetchGaussDbPricingCatalog } from "@/lib/gaussdb-pricing";
import { fetchGesPricingCatalog } from "@/lib/ges-pricing";
import { fetchHssPricingCatalog } from "@/lib/hss-pricing";
import { fetchLtsPricingCatalog } from "@/lib/lts-pricing";
import { fetchModelArtsPricingCatalog } from "@/lib/modelarts-pricing";
import { fetchNatPricingCatalog } from "@/lib/nat-pricing";
import { fetchObsPricingCatalog } from "@/lib/obs-pricing";
import { fetchRdsPricingCatalog } from "@/lib/rds-pricing";
import { fetchSfsPricingCatalog } from "@/lib/sfs-pricing";
import { fetchSfsTurboPricingCatalog } from "@/lib/sfs-turbo-pricing";
import { fetchSmnPricingCatalog } from "@/lib/smn-pricing";
import { fetchVpcepPricingCatalog } from "@/lib/vpcep-pricing";
import { fetchVpnPricingCatalog } from "@/lib/vpn-pricing";
import { fetchWafPricingCatalog } from "@/lib/waf-pricing";
import { fetchWorkspacePricingCatalog } from "@/lib/workspace-pricing";
import { fetchRegionSystemDiskPricing } from "@/lib/evs-disk-pricing";

type CatalogFetchFn = (regionId: string) => Promise<unknown>;

const catalogFetchMap: Record<string, CatalogFetchFn> = {
  APIG: fetchApigPricingCatalog,
  CBR: fetchCbrPricingCatalog,
  CCE: fetchCcePricingCatalog,
  CCM: fetchCcmPricingCatalog,
  CBH: fetchCbhPricingCatalog,
  CFW: fetchCfwPricingCatalog,
  CDM: fetchCdmPricingCatalog,
  CSE: fetchCsePricingCatalog,
  DCS: fetchDcsPricingCatalog,
  DDS: fetchDdsPricingCatalog,
  DEW: fetchDewPricingCatalog,
  DC: fetchDirectConnectPricingCatalog,
  DIS: fetchDisPricingCatalog,
  DLI: fetchDliPricingCatalog,
  DMS: fetchDmsPricingCatalog,
  DRS: fetchDrsPricingCatalog,
  MRS: fetchMrsPricingCatalog,
  DWS: fetchDwsPricingCatalog,
  ELB: fetchElbPricingCatalog,
  EIP: fetchEipPricingCatalog,
  ER: fetchErPricingCatalog,
  "Flexus RDS": fetchFlexusRdsPricingCatalog,
  FunctionGraph: fetchFunctionGraphPricingCatalog,
  GA: fetchGaPricingCatalog,
  GaussDB: fetchGaussDbPricingCatalog,
  GES: fetchGesPricingCatalog,
  HSS: fetchHssPricingCatalog,
  LTS: fetchLtsPricingCatalog,
  ModelArts: fetchModelArtsPricingCatalog,
  NAT: fetchNatPricingCatalog,
  OBS: fetchObsPricingCatalog,
  RDS: fetchRdsPricingCatalog,
  SFS: fetchSfsPricingCatalog,
  "SFS Turbo": fetchSfsTurboPricingCatalog,
  SMN: fetchSmnPricingCatalog,
  VPCEP: fetchVpcepPricingCatalog,
  VPN: fetchVpnPricingCatalog,
  WAF: fetchWafPricingCatalog,
  Workspace: fetchWorkspacePricingCatalog,
  EVS: fetchRegionSystemDiskPricing,
};

export function getCatalogFetchFn(serviceCode: string): CatalogFetchFn | undefined {
  return catalogFetchMap[serviceCode];
}
