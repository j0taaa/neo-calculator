import { configurableServiceBundle as apigBundle } from "@/config/services/apig/bundle";
import { configurableServiceBundle as cbhBundle } from "@/config/services/cbh/bundle";
import { configurableServiceBundle as cbrBundle } from "@/config/services/cbr/bundle";
import { configurableServiceBundle as dcsBundle } from "@/config/services/dcs/bundle";
import { configurableServiceBundle as dcBundle } from "@/config/services/dc/bundle";
import { configurableServiceBundle as eipBundle } from "@/config/services/eip/bundle";
import { configurableServiceBundle as erBundle } from "@/config/services/er/bundle";
import { configurableServiceBundle as flexusRdsBundle } from "@/config/services/flexus-rds/bundle";
import { configurableServiceBundle as natBundle } from "@/config/services/nat/bundle";
import { configurableServiceBundle as rdsBundle } from "@/config/services/rds/bundle";
import { configurableServiceBundle as sfsBundle } from "@/config/services/sfs/bundle";
import { configurableServiceBundle as vpcepBundle } from "@/config/services/vpcep/bundle";
import type { ApigPricingCatalog } from "@/lib/apig-catalog";
import type { CbhPricingCatalog } from "@/lib/cbh-catalog";
import type { CbrPricingCatalog } from "@/lib/cbr-catalog";
import type { DcsPricingCatalog } from "@/lib/dcs-catalog";
import type { DirectConnectPricingCatalog } from "@/lib/direct-connect-catalog";
import type { EipPricingCatalog } from "@/lib/eip-catalog";
import type { ErPricingCatalog } from "@/lib/er-catalog";
import type { FlexusRdsPricingCatalog } from "@/lib/flexus-rds-catalog";
import type { NatPricingCatalog } from "@/lib/nat-catalog";
import type { RdsPricingCatalog } from "@/lib/rds-catalog";
import type { SfsPricingCatalog } from "@/lib/sfs-catalog";
import type { VpcepPricingCatalog } from "@/lib/vpcep-catalog";

export const declarativePricingDefinitions = {
  APIG: apigBundle.catalogDefinition,
  CBH: cbhBundle.catalogDefinition,
  CBR: cbrBundle.catalogDefinition,
  NAT: natBundle.catalogDefinition,
  EIP: eipBundle.catalogDefinition,
  ER: erBundle.catalogDefinition,
  DCS: dcsBundle.catalogDefinition,
  DC: dcBundle.catalogDefinition,
  SFS: sfsBundle.catalogDefinition,
  VPCEP: vpcepBundle.catalogDefinition,
  RDS: rdsBundle.catalogDefinition,
  "Flexus RDS": flexusRdsBundle.catalogDefinition,
} as const;

export function getDeclarativePricingDefinition(serviceCode: "APIG" | "CBH" | "CBR" | "NAT" | "EIP" | "ER" | "DCS" | "DC" | "SFS" | "VPCEP" | "RDS" | "Flexus RDS") {
  return declarativePricingDefinitions[serviceCode];
}

export type DeclarativePricingServiceCode = keyof typeof declarativePricingDefinitions;
export type DeclarativePricingCatalogMap = {
  APIG: ApigPricingCatalog;
  CBH: CbhPricingCatalog;
  CBR: CbrPricingCatalog;
  NAT: NatPricingCatalog;
  EIP: EipPricingCatalog;
  ER: ErPricingCatalog;
  DCS: DcsPricingCatalog;
  DC: DirectConnectPricingCatalog;
  SFS: SfsPricingCatalog;
  VPCEP: VpcepPricingCatalog;
  RDS: RdsPricingCatalog;
  "Flexus RDS": FlexusRdsPricingCatalog;
};
