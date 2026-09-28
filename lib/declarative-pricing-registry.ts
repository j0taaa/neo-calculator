import { serviceBundles } from "@/config/services/bundles";
import type { DisPricingCatalog } from "@/lib/dis-catalog";
import type { ApigPricingCatalog } from "@/lib/apig-catalog";
import type { CbhPricingCatalog } from "@/lib/cbh-catalog";
import type { CbrPricingCatalog } from "@/lib/cbr-catalog";
import type { CcmPricingCatalog } from "@/lib/ccm-catalog";
import type { DcsPricingCatalog } from "@/lib/dcs-catalog";
import type { DirectConnectPricingCatalog } from "@/lib/direct-connect-catalog";
import type { EipPricingCatalog } from "@/lib/eip-catalog";
import type { ErPricingCatalog } from "@/lib/er-catalog";
import type { FlexusRdsPricingCatalog } from "@/lib/flexus-rds-catalog";
import type { GaPricingCatalog } from "@/lib/ga-catalog";
import type { GaussDbPricingCatalog } from "@/lib/gaussdb-catalog";
import type { GesPricingCatalog } from "@/lib/ges-catalog";
import type { CsePricingCatalog } from "@/lib/cse-catalog";
import type { LtsPricingCatalog } from "@/lib/lts-catalog";
import type { NatPricingCatalog } from "@/lib/nat-catalog";
import type { RdsPricingCatalog } from "@/lib/rds-catalog";
import type { SfsPricingCatalog } from "@/lib/sfs-catalog";
import type { SfsTurboPricingCatalog } from "@/lib/sfs-turbo-catalog";
import type { VpcepPricingCatalog } from "@/lib/vpcep-catalog";
import type { HssPricingCatalog } from "@/lib/hss-catalog";
import type { DewPricingCatalog } from "@/lib/dew-catalog";
import type { SmnPricingCatalog } from "@/lib/smn-catalog";
import type { DwsPricingCatalog } from "@/lib/dws-catalog";
import type { DliPricingCatalog } from "@/lib/dli-catalog";
import type { CdmPricingCatalog } from "@/lib/cdm-catalog";
import type { DdsPricingCatalog } from "@/lib/dds-catalog";
import type { WafPricingCatalog } from "@/lib/waf-catalog";
import type { CfwPricingCatalog } from "@/lib/cfw-catalog";
import type { DmsPricingCatalog } from "@/lib/dms-catalog";
import type { DrsPricingCatalog } from "@/lib/drs-catalog";
import type { MrsPricingCatalog } from "@/lib/mrs-catalog";
import type { DeclarativePricingDefinition } from "@/lib/declarative-pricing-engine";

export const declarativePricingDefinitions: Record<string, DeclarativePricingDefinition> = Object.fromEntries(
  serviceBundles.flatMap((bundle) => bundle.catalogDefinition ? [[bundle.service.serviceCode, bundle.catalogDefinition]] : []),
);

export function getDeclarativePricingDefinition(serviceCode: keyof DeclarativePricingCatalogMap) {
  const definition = declarativePricingDefinitions[serviceCode];
  if (!definition) throw new Error(`No declarative catalog definition for ${serviceCode}`);
  return definition;
}

export type DeclarativePricingServiceCode = keyof DeclarativePricingCatalogMap;
export type DeclarativePricingCatalogMap = {
  APIG: ApigPricingCatalog;
  CCM: CcmPricingCatalog;
  CBH: CbhPricingCatalog;
  CBR: CbrPricingCatalog;
  NAT: NatPricingCatalog;
  EIP: EipPricingCatalog;
  ER: ErPricingCatalog;
  GA: GaPricingCatalog;
  GaussDB: GaussDbPricingCatalog;
  GES: GesPricingCatalog;
  CSE: CsePricingCatalog;
  DCS: DcsPricingCatalog;
  DC: DirectConnectPricingCatalog;
  DIS: DisPricingCatalog;
  HSS: HssPricingCatalog;
  DEW: DewPricingCatalog;
  SMN: SmnPricingCatalog;
  DWS: DwsPricingCatalog;
  DLI: DliPricingCatalog;
  LTS: LtsPricingCatalog;
  SFS: SfsPricingCatalog;
  "SFS Turbo": SfsTurboPricingCatalog;
  VPCEP: VpcepPricingCatalog;
  RDS: RdsPricingCatalog;
  "Flexus RDS": FlexusRdsPricingCatalog;
  CDM: CdmPricingCatalog;
  DDS: DdsPricingCatalog;
  WAF: WafPricingCatalog;
  CFW: CfwPricingCatalog;
  DMS: DmsPricingCatalog;
  DRS: DrsPricingCatalog;
  MRS: MrsPricingCatalog;
};
