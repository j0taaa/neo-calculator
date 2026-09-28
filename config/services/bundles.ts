import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { configurableServiceBundle as apig } from "./apig/bundle";
import { configurableServiceBundle as ccm } from "./ccm/bundle";
import { configurableServiceBundle as cbh } from "./cbh/bundle";
import { configurableServiceBundle as cbr } from "./cbr/bundle";
import { configurableServiceBundle as cce } from "./cce/bundle";
import { configurableServiceBundle as cci } from "./cci/bundle";
import { configurableServiceBundle as cse } from "./cse/bundle";
import { configurableServiceBundle as dcs } from "./dcs/bundle";
import { configurableServiceBundle as dc } from "./dc/bundle";
import { configurableServiceBundle as dis } from "./dis/bundle";
import { configurableServiceBundle as eip } from "./eip/bundle";
import { configurableServiceBundle as elb } from "./elb/bundle";
import { configurableServiceBundle as evs } from "./evs/bundle";
import { configurableServiceBundle as er } from "./er/bundle";
import { configurableServiceBundle as flexusRds } from "./flexus-rds/bundle";
import { configurableServiceBundle as functionGraph } from "./functiongraph/bundle";
import { configurableServiceBundle as ga } from "./ga/bundle";
import { configurableServiceBundle as ges } from "./ges/bundle";
import { configurableServiceBundle as lts } from "./lts/bundle";
import { configurableServiceBundle as modelarts } from "./modelarts/bundle";
import { configurableServiceBundle as nat } from "./nat/bundle";
import { configurableServiceBundle as obs } from "./obs/bundle";
import { configurableServiceBundle as rds } from "./rds/bundle";
import { configurableServiceBundle as sfs } from "./sfs/bundle";
import { configurableServiceBundle as sfsTurbo } from "./sfsturbo/bundle";
import { configurableServiceBundle as vpcep } from "./vpcep/bundle";
import { configurableServiceBundle as hss } from "./hss/bundle";
import { configurableServiceBundle as dew } from "./dew/bundle";
import { configurableServiceBundle as smn } from "./smn/bundle";
import { configurableServiceBundle as dws } from "./dws/bundle";
import { configurableServiceBundle as dli } from "./dli/bundle";
import { configurableServiceBundle as cdm } from "./cdm/bundle";
import { configurableServiceBundle as dds } from "./dds/bundle";
import { configurableServiceBundle as waf } from "./waf/bundle";
import { configurableServiceBundle as cfw } from "./cfw/bundle";
import { configurableServiceBundle as dms } from "./dms/bundle";
import { configurableServiceBundle as drs } from "./drs/bundle";
import { configurableServiceBundle as gaussDb } from "./gaussdb/bundle";
import { configurableServiceBundle as mrs } from "./mrs/bundle";
import { configurableServiceBundle as vpn } from "./vpn/bundle";
import { configurableServiceBundle as workspace } from "./workspace/bundle";

// The only list of configurable implementations. Keep this module browser-safe.
export const serviceBundles: readonly ConfigurableServiceBundleDefinition[] = [
  obs,
  evs,
  eip,
  elb,
  nat,
  vpn,
  cce,
  cci,
  modelarts,
  workspace,
  dcs,
  dc,
  cbr,
  sfs,
  sfsTurbo,
  ccm,
  cbh,
  vpcep,
  functionGraph,
  rds,
  flexusRds,
  er,
  apig,
  lts,
  ga,
  ges,
  cse,
  dis,
  hss,
  dew,
  smn,
  dws,
  dli,
  cdm,
  dds,
  waf,
  cfw,
  dms,
  gaussDb,
  drs,
  mrs,
];

export function getServiceBundle(serviceCode: string) {
  return serviceBundles.find((bundle) => bundle.service.serviceCode === serviceCode) ?? null;
}
