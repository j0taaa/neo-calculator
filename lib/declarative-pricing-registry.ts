import { configurableServiceBundle as apigBundle } from "@/config/services/apig/bundle";
import { configurableServiceBundle as ccmBundle } from "@/config/services/ccm/bundle";
import { configurableServiceBundle as cbhBundle } from "@/config/services/cbh/bundle";
import { configurableServiceBundle as cbrBundle } from "@/config/services/cbr/bundle";
import { configurableServiceBundle as dcsBundle } from "@/config/services/dcs/bundle";
import { configurableServiceBundle as dcBundle } from "@/config/services/dc/bundle";
import { configurableServiceBundle as eipBundle } from "@/config/services/eip/bundle";
import { configurableServiceBundle as erBundle } from "@/config/services/er/bundle";
import { configurableServiceBundle as flexusRdsBundle } from "@/config/services/flexus-rds/bundle";
import { configurableServiceBundle as gaBundle } from "@/config/services/ga/bundle";
import { configurableServiceBundle as gaussDbBundle } from "@/config/services/gaussdb/bundle";
import { configurableServiceBundle as gesBundle } from "@/config/services/ges/bundle";
import { configurableServiceBundle as cseBundle } from "@/config/services/cse/bundle";
import { configurableServiceBundle as ltsBundle } from "@/config/services/lts/bundle";
import { configurableServiceBundle as natBundle } from "@/config/services/nat/bundle";
import { configurableServiceBundle as rdsBundle } from "@/config/services/rds/bundle";
import { configurableServiceBundle as sfsBundle } from "@/config/services/sfs/bundle";
import { configurableServiceBundle as sfsTurboBundle } from "@/config/services/sfsturbo/bundle";
import { configurableServiceBundle as disBundle } from "@/config/services/dis/bundle";
import { configurableServiceBundle as vpcepBundle } from "@/config/services/vpcep/bundle";
import { configurableServiceBundle as hssBundle } from "@/config/services/hss/bundle";
import { configurableServiceBundle as dewBundle } from "@/config/services/dew/bundle";
import { configurableServiceBundle as smnBundle } from "@/config/services/smn/bundle";
import { configurableServiceBundle as dwsBundle } from "@/config/services/dws/bundle";
import { configurableServiceBundle as dliBundle } from "@/config/services/dli/bundle";
import { configurableServiceBundle as cdmBundle } from "@/config/services/cdm/bundle";
import { configurableServiceBundle as ddsBundle } from "@/config/services/dds/bundle";
import { configurableServiceBundle as wafBundle } from "@/config/services/waf/bundle";
import { configurableServiceBundle as cfwBundle } from "@/config/services/cfw/bundle";
import { configurableServiceBundle as dmsBundle } from "@/config/services/dms/bundle";
import { configurableServiceBundle as drsBundle } from "@/config/services/drs/bundle";
import { configurableServiceBundle as mrsBundle } from "@/config/services/mrs/bundle";
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

export const declarativePricingDefinitions: Record<string, DeclarativePricingDefinition> = {
  APIG: apigBundle.catalogDefinition,
  CCM: ccmBundle.catalogDefinition,
  CBH: cbhBundle.catalogDefinition,
  CBR: cbrBundle.catalogDefinition,
  NAT: natBundle.catalogDefinition,
  EIP: eipBundle.catalogDefinition,
  ER: erBundle.catalogDefinition,
  GA: gaBundle.catalogDefinition,
  GaussDB: gaussDbBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  GES: gesBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  CSE: cseBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  DCS: dcsBundle.catalogDefinition,
  DC: dcBundle.catalogDefinition,
  DIS: disBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  HSS: hssBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  DEW: dewBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  SMN: smnBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  DWS: dwsBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  DLI: dliBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  LTS: ltsBundle.catalogDefinition,
  SFS: sfsBundle.catalogDefinition,
  "SFS Turbo": sfsTurboBundle.catalogDefinition,
  VPCEP: vpcepBundle.catalogDefinition,
  RDS: rdsBundle.catalogDefinition,
  "Flexus RDS": flexusRdsBundle.catalogDefinition,
  CDM: cdmBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  DDS: ddsBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  WAF: wafBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  CFW: cfwBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  DMS: dmsBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  DRS: drsBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
  MRS: mrsBundle.catalogDefinition as unknown as DeclarativePricingDefinition,
};

export function getDeclarativePricingDefinition(serviceCode: "APIG" | "CCM" | "CBH" | "CBR" | "NAT" | "EIP" | "ER" | "GA" | "GaussDB" | "GES" | "CSE" | "DCS" | "DC" | "DIS" | "HSS" | "DEW" | "SMN" | "DWS" | "DLI" | "LTS" | "SFS" | "SFS Turbo" | "VPCEP" | "RDS" | "Flexus RDS" | "CDM" | "DDS" | "WAF" | "CFW" | "DMS" | "DRS" | "MRS") {
  return declarativePricingDefinitions[serviceCode];
}

export type DeclarativePricingServiceCode = keyof typeof declarativePricingDefinitions;
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
