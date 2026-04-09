import { configurableServiceBundle as apigBundle } from "@/config/services/apig/bundle";
import { configurableServiceBundle as ccmBundle } from "@/config/services/ccm/bundle";
import { configurableServiceBundle as cbhBundle } from "@/config/services/cbh/bundle";
import { configurableServiceBundle as cbrBundle } from "@/config/services/cbr/bundle";
import { configurableServiceBundle as cceBundle } from "@/config/services/cce/bundle";
import { configurableServiceBundle as cciBundle } from "@/config/services/cci/bundle";
import { configurableServiceBundle as cseBundle } from "@/config/services/cse/bundle";
import { configurableServiceBundle as dcsBundle } from "@/config/services/dcs/bundle";
import { configurableServiceBundle as dcBundle } from "@/config/services/dc/bundle";
import { configurableServiceBundle as disBundle } from "@/config/services/dis/bundle";
import { configurableServiceBundle as eipBundle } from "@/config/services/eip/bundle";
import { configurableServiceBundle as elbBundle } from "@/config/services/elb/bundle";
import { configurableServiceBundle as evsBundle } from "@/config/services/evs/bundle";
import { configurableServiceBundle as erBundle } from "@/config/services/er/bundle";
import { configurableServiceBundle as flexusRdsBundle } from "@/config/services/flexus-rds/bundle";
import { configurableServiceBundle as functionGraphBundle } from "@/config/services/functiongraph/bundle";
import { configurableServiceBundle as gaBundle } from "@/config/services/ga/bundle";
import { configurableServiceBundle as gesBundle } from "@/config/services/ges/bundle";
import { configurableServiceBundle as ltsBundle } from "@/config/services/lts/bundle";
import { configurableServiceBundle as modelArtsBundle } from "@/config/services/modelarts/bundle";
import { configurableServiceBundle as natBundle } from "@/config/services/nat/bundle";
import { configurableServiceBundle as obsBundle } from "@/config/services/obs/bundle";
import { configurableServiceBundle as rdsBundle } from "@/config/services/rds/bundle";
import { configurableServiceBundle as sfsBundle } from "@/config/services/sfs/bundle";
import { configurableServiceBundle as sfsTurboBundle } from "@/config/services/sfsturbo/bundle";
import { configurableServiceBundle as vpcepBundle } from "@/config/services/vpcep/bundle";
import { configurableServiceBundle as vpnBundle } from "@/config/services/vpn/bundle";
import { configurableServiceBundle as workspaceBundle } from "@/config/services/workspace/bundle";
import { configurableServiceBundle as hssBundle } from "@/config/services/hss/bundle";
import { configurableServiceBundle as dewBundle } from "@/config/services/dew/bundle";
import { configurableServiceBundle as smnBundle } from "@/config/services/smn/bundle";
import { configurableServiceBundle as dwsBundle } from "@/config/services/dws/bundle";
import { configurableServiceBundle as dliBundle } from "@/config/services/dli/bundle";
import { configurableServiceBundle as cdmBundle } from "@/config/services/cdm/bundle";
import { configurableServiceBundle as ddsBundle } from "@/config/services/dds/bundle";
import { configurableServiceBundle as wafBundle } from "@/config/services/waf/bundle";
import { configurableServiceBundle as cfwBundle } from "@/config/services/cfw/bundle";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import type { TypedDeclarativeRuntimeDefinition } from "@/lib/typed-declarative-runtime-types";

const typedRuntimeDefinitions = {
  APIG: apigBundle.runtime,
  CCM: ccmBundle.runtime,
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
  GA: gaBundle.runtime,
  GES: gesBundle.runtime,
  CSE: cseBundle.runtime,
  DC: dcBundle.runtime,
  DIS: disBundle.runtime,
  LTS: ltsBundle.runtime,
  SFS: sfsBundle.runtime,
  "SFS Turbo": sfsTurboBundle.runtime,
  VPCEP: vpcepBundle.runtime,
  "Flexus RDS": flexusRdsBundle.runtime,
  RDS: rdsBundle.runtime,
  NAT: natBundle.runtime,
  EIP: eipBundle.runtime,
  ER: erBundle.runtime,
  DCS: dcsBundle.runtime,
  HSS: hssBundle.runtime,
  DEW: dewBundle.runtime,
  SMN: smnBundle.runtime,
  DWS: dwsBundle.runtime,
  DLI: dliBundle.runtime,
  CDM: cdmBundle.runtime,
  DDS: ddsBundle.runtime,
  WAF: wafBundle.runtime,
  CFW: cfwBundle.runtime,
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
