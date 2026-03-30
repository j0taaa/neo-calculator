import { configurableServiceBundle as dcsBundle } from "@/config/services/dcs/bundle";
import { configurableServiceBundle as eipBundle } from "@/config/services/eip/bundle";
import { configurableServiceBundle as flexusRdsBundle } from "@/config/services/flexus-rds/bundle";
import { configurableServiceBundle as natBundle } from "@/config/services/nat/bundle";
import { configurableServiceBundle as rdsBundle } from "@/config/services/rds/bundle";
import type { DcsPricingCatalog } from "@/lib/dcs-catalog";
import type { EipPricingCatalog } from "@/lib/eip-catalog";
import type { FlexusRdsPricingCatalog } from "@/lib/flexus-rds-catalog";
import type { NatPricingCatalog } from "@/lib/nat-catalog";
import type { RdsPricingCatalog } from "@/lib/rds-catalog";

export const declarativePricingDefinitions = {
  NAT: natBundle.catalogDefinition,
  EIP: eipBundle.catalogDefinition,
  DCS: dcsBundle.catalogDefinition,
  RDS: rdsBundle.catalogDefinition,
  "Flexus RDS": flexusRdsBundle.catalogDefinition,
} as const;

export function getDeclarativePricingDefinition(serviceCode: "NAT" | "EIP" | "DCS" | "RDS" | "Flexus RDS") {
  return declarativePricingDefinitions[serviceCode];
}

export type DeclarativePricingServiceCode = keyof typeof declarativePricingDefinitions;
export type DeclarativePricingCatalogMap = {
  NAT: NatPricingCatalog;
  EIP: EipPricingCatalog;
  DCS: DcsPricingCatalog;
  RDS: RdsPricingCatalog;
  "Flexus RDS": FlexusRdsPricingCatalog;
};
