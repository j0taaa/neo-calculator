import type { DcsPricingCatalog } from "@/lib/dcs-catalog";
import type { EipPricingCatalog } from "@/lib/eip-catalog";
import type { NatPricingCatalog } from "@/lib/nat-catalog";
import type { DeclarativePricingDefinition } from "@/lib/declarative-pricing-engine";

const natPricingDefinition = {
  source: {
    displayName: "NAT",
    urlPath: "nat",
    tab: "calc",
  },
  parser: {
    kind: "sectioned-rate-set",
    currency: "USD",
    collectionKey: "tiers",
    sections: [
      {
        path: "product.natgateway_natgateway",
        fields: [
          { key: "type", extractor: { kind: "literal", value: "Public NAT Gateway" } },
          {
            key: "size",
            required: true,
            extractor: {
              kind: "contains-map",
              path: "resourceSpecCode",
              mappings: [
                { contains: "middle", value: "Medium" },
                { contains: "medium", value: "Medium" },
                { contains: "xlarge", value: "Extra-large" },
                { contains: "large", value: "Large" },
                { contains: "small", value: "Small" },
              ],
            },
          },
          { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode", template: "{type}-{size}" } },
          { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        ],
      },
      {
        path: "product.natgateway_privatenat",
        fields: [
          { key: "type", extractor: { kind: "literal", value: "Private NAT Gateway" } },
          {
            key: "size",
            required: true,
            extractor: {
              kind: "contains-map",
              path: "resourceSpecCode",
              mappings: [
                { contains: "middle", value: "Medium" },
                { contains: "medium", value: "Medium" },
                { contains: "xlarge", value: "Extra-large" },
                { contains: "large", value: "Large" },
                { contains: "small", value: "Small" },
              ],
            },
          },
          { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode", template: "{type}-{size}" } },
          { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        ],
      },
    ],
  },
} as const satisfies DeclarativePricingDefinition;

const eipPricingDefinition = {
  source: {
    displayName: "EIP",
    urlPath: "eip",
    tab: "calc",
  },
  parser: {
    kind: "selected-records",
    currency: "USD",
    collections: [
      { id: "eipItems", path: "product.vpc_ip" },
      { id: "bandwidthItems", path: "product.vpc_bandwidth" },
      { id: "dedicatedEipPreferred", from: "eipItems", filters: [{ kind: "field-equals", path: "resourceSpecCode", value: "5_bgp" }] },
      {
        id: "dedicatedBandwidthPreferred",
        from: "bandwidthItems",
        filters: [
          { kind: "field-equals", path: "resourceSpecCode", value: "19_bgp" },
          { kind: "field-equals", path: "shareType", value: "dataInfo_3_" },
          { kind: "field-equals", path: "eipType", value: "dataInfo_5_" },
        ],
      },
      {
        id: "dedicatedBandwidthFallback",
        from: "bandwidthItems",
        filters: [{ kind: "field-equals", path: "resourceSpecCode", value: "19_bgp" }],
      },
      {
        id: "sharedBandwidthPreferred",
        from: "bandwidthItems",
        filters: [
          { kind: "field-equals", path: "resourceSpecCode", value: "19_share" },
          { kind: "field-equals", path: "shareType", value: "dataInfo_4_" },
          { kind: "field-equals", path: "eipType", value: "dataInfo_5_" },
        ],
      },
      {
        id: "sharedBandwidthFallback",
        from: "bandwidthItems",
        filters: [
          { kind: "field-equals", path: "resourceSpecCode", value: "19_share" },
          { kind: "field-equals", path: "eipType", value: "dataInfo_5_" },
        ],
      },
      {
        id: "sharedEnhanced95",
        from: "bandwidthItems",
        filters: [
          { kind: "field-equals", path: "resourceSpecCode", value: "19_share" },
          { kind: "field-equals", path: "shareType", value: "dataInfo_4_" },
          { kind: "field-equals", path: "eipType", value: "dataInfo_17_" },
        ],
      },
      {
        id: "dedicatedTrafficPreferred",
        from: "bandwidthItems",
        filters: [
          { kind: "field-equals", path: "resourceSpecCode", value: "12_bgp" },
          { kind: "field-equals", path: "shareType", value: "dataInfo_3_" },
        ],
      },
      {
        id: "dedicatedTrafficFallback",
        from: "bandwidthItems",
        filters: [{ kind: "field-equals", path: "resourceSpecCode", value: "12_bgp" }],
      },
      {
        id: "dedicatedTrafficPackages",
        from: "bandwidthItems",
        filters: [
          { kind: "field-starts-with", path: "resourceSpecCode", value: "12_bgp_" },
          { kind: "field-equals", path: "shareType", value: "dataInfo_13_" },
        ],
      },
    ],
    outputs: [
      {
        targetPath: "dedicated.eipRates",
        extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
        fromCollections: ["dedicatedEipPreferred", "eipItems"],
      },
      {
        targetPath: "dedicated.bandwidthRates",
        extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
        fromCollections: ["dedicatedBandwidthPreferred", "dedicatedBandwidthFallback"],
      },
      {
        targetPath: "dedicated.trafficRatePerGb",
        extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.bandwidthupflow" },
        fromCollections: ["dedicatedTrafficPreferred", "dedicatedTrafficFallback"],
      },
      {
        targetPath: "dedicated.trafficRateTiers",
        extractor: { kind: "division-tiers", billingMode: "ONDEMAND", billingEvent: "event.type.bandwidthupflow" },
        fromCollections: ["dedicatedTrafficPreferred", "dedicatedTrafficFallback"],
      },
      {
        targetPath: "dedicated.trafficPackages.MONTHLY",
        extractor: { kind: "packages", billingModes: ["MONTHLY"], sizePath: "resourceSpecCode", sizeRegex: "_(\\d+)GB$" },
        fromCollection: "dedicatedTrafficPackages",
      },
      {
        targetPath: "dedicated.trafficPackages.YEARLY",
        extractor: { kind: "packages", billingModes: ["YEARLY"], sizePath: "resourceSpecCode", sizeRegex: "_(\\d+)GB$" },
        fromCollection: "dedicatedTrafficPackages",
      },
      {
        targetPath: "shared.bandwidthRates",
        extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
        fromCollections: ["sharedBandwidthPreferred", "sharedBandwidthFallback"],
      },
      {
        targetPath: "shared.enhanced95MonthlyBaseRate",
        extractor: { kind: "plan-amount", billingMode: "ONDEMAND" },
        fromCollection: "sharedEnhanced95",
      },
    ],
  },
} as const satisfies DeclarativePricingDefinition;

const dcsPricingDefinition = {
  source: {
    displayName: "DCS",
    urlPath: "redis",
    tab: "calc",
  },
  parser: {
    kind: "recursive-grouped-records",
    currency: "USD",
    rootPath: "product",
    collectionKey: "instanceTiers",
    catalogStatic: {
      edition: "Basic",
    },
    recordFilters: [
      { kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc", "productId"], value: "redis" },
      { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "productId"], value: "bandwidth" },
      { kind: "field-not-equals", path: "product_type", value: "professional" },
      { kind: "field-not-equals", path: "resourceSpecType", value: "dcs_enterprise" },
      { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "productId"], value: "product_type:professional" },
    ],
    fields: [
      { key: "edition", extractor: { kind: "literal", value: "Basic" } },
      { key: "version", required: true, extractor: { kind: "enum-from-pattern", paths: ["versionKey", "version", "redisVersion", "engineVersion", "productSpecSysDesc", "resourceSpecCode", "productId"], values: ["7.0", "6.0", "5.0", "4.0"] } },
      {
        key: "instanceType",
        required: true,
        extractor: {
          kind: "keyword-map",
          directPath: "cache_mode",
          directMap: {
            single_node: "Single-node",
            cluster: "Redis Cluster",
            master_standby: "Master/Standby",
          },
          textPaths: ["instanceType", "type", "mode", "productSpecSysDesc", "resourceSpecCode", "productId"],
          mappings: [
            { keywords: ["single"], value: "Single-node" },
            { keywords: ["cluster"], value: "Redis Cluster" },
            { keywords: ["master", "standby"], value: "Master/Standby" },
            { keywords: ["ha"], value: "Master/Standby" },
          ],
        },
      },
      {
        key: "architecture",
        required: true,
        extractor: {
          kind: "keyword-map",
          directPath: "cpu",
          directMap: {
            aarch64: "ARM | DRAM",
            x86_64: "x86 | DRAM",
          },
          textPaths: ["architecture", "cpuArch", "cpuType", "productSpecSysDesc", "resourceSpecCode", "productId"],
          mappings: [
            { keywords: ["arm"], value: "ARM | DRAM" },
            { keywords: ["x86"], value: "x86 | DRAM" },
            { keywords: ["x64"], value: "x86 | DRAM" },
          ],
        },
      },
      { key: "memoryGiB", required: true, extractor: { kind: "memory-gib", paths: ["memory", "mem", "capacity", "size", "specification"] } },
      { key: "specification", extractor: { kind: "path-or-template", path: "specification", template: "{memoryGiB} GB" } },
      {
        key: "replicas",
        extractor: {
          kind: "replica-count",
          numberPaths: ["replicas", "replica", "replicaNum", "standbyNum", "slaveNum", "nodeNum", "repl_spec", "replica_Number"],
          textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId"],
          fallbackByField: { field: "instanceType", equals: "Master/Standby", value: 2 },
        },
      },
      { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode", template: "{version}-{instanceType}-{architecture}-{memoryGiB}" } },
      { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND"] } },
      { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
    ],
    postRejectWhenAll: [
      [
        { field: "instanceType", notEquals: "Redis Cluster" },
        { field: "memoryGiB", gt: 64 },
      ],
      [
        { field: "instanceType", equals: "Redis Cluster" },
        { field: "memoryGiB", lt: 4 },
      ],
    ],
    dedupeBy: ["version", "instanceType", "architecture", "replicas", "specification"],
    minByPath: "prices.ONDEMAND",
    sort: [
      { path: "version", direction: "asc", order: ["7.0", "6.0", "5.0", "4.0"] },
      { path: "instanceType", direction: "asc", order: ["Single-node", "Master/Standby", "Redis Cluster"] },
      { path: "architecture", direction: "asc", order: ["x86 | DRAM", "ARM | DRAM"] },
      { path: "replicas", direction: "asc" },
      { path: "memoryGiB", direction: "asc" },
    ],
    auxiliaryOutputs: [
      {
        targetPath: "bandwidthRatePerMbitHour",
        extractor: {
          kind: "bandwidth-rate-per-unit",
          billingMode: "ONDEMAND",
          numberPaths: ["bandwidth", "bandwidthMbit", "measureValue", "value"],
          textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId", "type"],
          textRegex: "(\\d+(?:\\.\\d+)?)\\s*mbit",
          defaultUnits: 1,
        },
        filters: [
          { kind: "text-includes", paths: ["type", "productSpecSysDesc", "resourceSpecCode", "productId"], value: "bandwidth" },
        ],
      },
    ],
  },
} as const satisfies DeclarativePricingDefinition;

export const declarativePricingDefinitions = {
  NAT: natPricingDefinition,
  EIP: eipPricingDefinition,
  DCS: dcsPricingDefinition,
} as const;

export function getDeclarativePricingDefinition(serviceCode: "NAT" | "EIP" | "DCS") {
  return declarativePricingDefinitions[serviceCode];
}

export type DeclarativePricingServiceCode = keyof typeof declarativePricingDefinitions;
export type DeclarativePricingCatalogMap = {
  NAT: NatPricingCatalog;
  EIP: EipPricingCatalog;
  DCS: DcsPricingCatalog;
};
