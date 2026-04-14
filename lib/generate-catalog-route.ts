import { createCatalogRoute } from "@/lib/create-catalog-route";
import { getCatalogFetchFn } from "@/lib/catalog-fetch-registry";

type CatalogRouteConfig = {
  serviceCode: string;
  serviceName: string;
  responseKey?: string;
  wrapWithErrorHandler?: boolean;
};

const routeConfigMap: Record<string, CatalogRouteConfig> = {
  "apig-pricing": { serviceCode: "APIG", serviceName: "API Gateway" },
  "cbr-pricing": { serviceCode: "CBR", serviceName: "Cloud Backup and Recovery" },
  "cce-pricing": { serviceCode: "CCE", serviceName: "CCE" },
  "ccm-pricing": { serviceCode: "CCM", serviceName: "Cloud Certificate & Manager", wrapWithErrorHandler: true },
  "cbh-pricing": { serviceCode: "CBH", serviceName: "Cloud Bastion Host" },
  "cdm-pricing": { serviceCode: "CDM", serviceName: "CDM" },
  "cfw-pricing": { serviceCode: "CFW", serviceName: "CFW" },
  "cse-pricing": { serviceCode: "CSE", serviceName: "CSE" },
  "dcs-pricing": { serviceCode: "DCS", serviceName: "DCS" },
  "dds-pricing": { serviceCode: "DDS", serviceName: "DDS" },
  "dew-pricing": { serviceCode: "DEW", serviceName: "DEW" },
  "direct-connect-pricing": { serviceCode: "DC", serviceName: "Direct Connect" },
  "dis-pricing": { serviceCode: "DIS", serviceName: "DIS" },
  "dli-pricing": { serviceCode: "DLI", serviceName: "DLI" },
  "dms-pricing": { serviceCode: "DMS", serviceName: "DMS Kafka" },
  "drs-pricing": { serviceCode: "DRS", serviceName: "DRS" },
  "gaussdb-pricing": { serviceCode: "GaussDB", serviceName: "GaussDB" },
  "mrs-pricing": { serviceCode: "MRS", serviceName: "MRS" },
  "dws-pricing": { serviceCode: "DWS", serviceName: "DWS" },
  "eip-pricing": { serviceCode: "EIP", serviceName: "EIP" },
  "elb-pricing": { serviceCode: "ELB", serviceName: "ELB" },
  "er-pricing": { serviceCode: "ER", serviceName: "Enterprise Router" },
  "evs-pricing": { serviceCode: "EVS", serviceName: "EVS", responseKey: "diskPricing" },
  "flexus-rds-pricing": { serviceCode: "Flexus RDS", serviceName: "Flexus RDS" },
  "functiongraph-pricing": { serviceCode: "FunctionGraph", serviceName: "FunctionGraph" },
  "ges-pricing": { serviceCode: "GES", serviceName: "GES" },
  "hss-pricing": { serviceCode: "HSS", serviceName: "HSS" },
  "lts-pricing": { serviceCode: "LTS", serviceName: "LTS" },
  "modelarts-pricing": { serviceCode: "ModelArts", serviceName: "ModelArts" },
  "nat-pricing": { serviceCode: "NAT", serviceName: "NAT" },
  "obs-pricing": { serviceCode: "OBS", serviceName: "OBS" },
  "rds-pricing": { serviceCode: "RDS", serviceName: "RDS" },
  "sfs-pricing": { serviceCode: "SFS", serviceName: "Scalable File Service", wrapWithErrorHandler: true },
  "sfsturbo-pricing": { serviceCode: "SFS Turbo", serviceName: "Scalable File Service Turbo", wrapWithErrorHandler: true },
  "smn-pricing": { serviceCode: "SMN", serviceName: "SMN" },
  "vpcep-pricing": { serviceCode: "VPCEP", serviceName: "VPC Endpoint" },
  "vpn-pricing": { serviceCode: "VPN", serviceName: "VPN" },
  "waf-pricing": { serviceCode: "WAF", serviceName: "WAF" },
  "workspace-pricing": { serviceCode: "Workspace", serviceName: "Workspace" },
};

export function generateCatalogRoute(dirName: string) {
  const config = routeConfigMap[dirName];
  if (!config) throw new Error(`Unknown catalog route: ${dirName}`);

  const fetchFn = getCatalogFetchFn(config.serviceCode);
  if (!fetchFn) throw new Error(`No fetch function for service code: ${config.serviceCode}`);

  return createCatalogRoute(fetchFn, {
    serviceName: config.serviceName,
    responseKey: config.responseKey,
    wrapWithErrorHandler: config.wrapWithErrorHandler,
  });
}
