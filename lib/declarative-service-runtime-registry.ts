import { configurableServiceBundle as cbhBundle } from "@/config/services/cbh/bundle";
import { configurableServiceBundle as cbrBundle } from "@/config/services/cbr/bundle";
import { configurableServiceBundle as cceBundle } from "@/config/services/cce/bundle";
import { configurableServiceBundle as cciBundle } from "@/config/services/cci/bundle";
import { configurableServiceBundle as dcsBundle } from "@/config/services/dcs/bundle";
import { configurableServiceBundle as dcBundle } from "@/config/services/dc/bundle";
import { configurableServiceBundle as eipBundle } from "@/config/services/eip/bundle";
import { configurableServiceBundle as elbBundle } from "@/config/services/elb/bundle";
import { configurableServiceBundle as evsBundle } from "@/config/services/evs/bundle";
import { configurableServiceBundle as flexusRdsBundle } from "@/config/services/flexus-rds/bundle";
import { configurableServiceBundle as functionGraphBundle } from "@/config/services/functiongraph/bundle";
import { configurableServiceBundle as modelArtsBundle } from "@/config/services/modelarts/bundle";
import { configurableServiceBundle as natBundle } from "@/config/services/nat/bundle";
import { configurableServiceBundle as obsBundle } from "@/config/services/obs/bundle";
import { configurableServiceBundle as rdsBundle } from "@/config/services/rds/bundle";
import { configurableServiceBundle as sfsBundle } from "@/config/services/sfs/bundle";
import { configurableServiceBundle as vpcepBundle } from "@/config/services/vpcep/bundle";
import { configurableServiceBundle as vpnBundle } from "@/config/services/vpn/bundle";
import { configurableServiceBundle as workspaceBundle } from "@/config/services/workspace/bundle";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import type { TypedDeclarativeRuntimeDefinition } from "@/lib/typed-declarative-runtime-types";

const typedRuntimeDefinitions = {
  CBH: cbhBundle.runtime,
  CBR: cbrBundle.runtime,
  CCE: cceBundle.runtime,
  CCI: cciBundle.runtime,
  EVS: evsBundle.runtime,
  ELB: elbBundle.runtime,
  OBS: obsBundle.runtime,
  ModelArts: modelArtsBundle.runtime,
  VPN: vpnBundle.runtime,
  Workspace: workspaceBundle.runtime,
  FunctionGraph: functionGraphBundle.runtime,
  DC: dcBundle.runtime,
  SFS: sfsBundle.runtime,
  VPCEP: vpcepBundle.runtime,
  "Flexus RDS": flexusRdsBundle.runtime,
  RDS: rdsBundle.runtime,
  NAT: natBundle.runtime,
  EIP: eipBundle.runtime,
  DCS: dcsBundle.runtime,
} as const;

export function getTypedDeclarativeRuntimeDefinitionByCode(serviceCode: string): TypedDeclarativeRuntimeDefinition | null {
  return (typedRuntimeDefinitions[serviceCode as keyof typeof typedRuntimeDefinitions] ?? null) as TypedDeclarativeRuntimeDefinition | null;
}

export function getDeclarativeRuntimeDefinitionByCode(serviceCode?: string): DeclarativeRuntimeDefinition | null {
  if (serviceCode) {
    return null;
  }

  return null;
}
