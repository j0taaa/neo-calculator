import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "rds",
  serviceCode: "RDS",
  serviceName: "Relational Database Service",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/RDSforMySQL.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use"],
  defaults: {
    engine: "MySQL",
    version: "8.0",
    instanceType: "Primary/Standby",
    subAz: "General AZ",
    instanceClass: "General-purpose",
    size: "2 vCPUs, 4 GB",
    storageType: "Flexible SSD",
    storageSizeGb: 40,
    iops: 3000,
    throughputMibps: 128,
    usageHours: 744,
    quantity: 1,
  },
  fields: [
    { id: "engine", type: "select", label: "DB Engine", required: true, optionsSource: "catalog.engineOptions" },
    { id: "version", type: "select", label: "DB Engine Version", required: true, optionsSource: "catalog.versionOptions" },
    { id: "instanceType", type: "select", label: "DB Instance Type", required: true, optionsSource: "catalog.instanceTypeOptions" },
    { id: "subAz", type: "select", label: "Sub-AZ", required: true, options: ["General AZ"], visibleWhen: { field: "instanceType", equals: "Primary/Standby" } },
    { id: "instanceClass", type: "select", label: "DB Instance Class", required: true, optionsSource: "catalog.instanceClassOptions" },
    { id: "size", type: "select", label: "Instance size", required: true, optionsSource: "catalog.sizeOptions" },
    { id: "storageType", type: "select", label: "Storage", required: true, optionsSource: "catalog.storageTypeOptions" },
    { id: "storageSizeGb", type: "number", label: "Storage size", required: true, unit: "GB", min: 40, max: 65536, step: 10 },
    { id: "iops", type: "number", label: "IOPS", required: true, min: 3000, step: 100, visibleWhen: { field: "storageType", equals: "Flexible SSD" } },
    { id: "throughputMibps", type: "number", label: "Throughput", required: true, unit: "MiB/s", min: 1, step: 1, visibleWhen: { field: "storageType", equals: "Flexible SSD" } },
    { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24 },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{engine} | {version} | {instanceType} | {instanceClass} | {size} | {storageType}",
    notes: [
      "This calculator currently models the MySQL/PostgreSQL pay-per-use subset for Primary/Standby, Single, and Read replica instances.",
      "Read replica pricing covers only the replica. The primary DB instance must be purchased separately.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "rds",
  serviceCode: "RDS",
  serviceName: "Relational Database Service",
  catalogAdapter: "rds",
  rateSources: {
    compute: {
      catalogKey: "computeTiers.prices",
      description: "Normalized RDS compute rates from the Huawei calculator catalog.",
    },
    storage: {
      catalogKey: "storageTiers.prices",
      description: "Normalized RDS storage rates from the Huawei calculator catalog.",
    },
  },
  metrics: [
    {
      id: "compute",
      label: "DB instance",
      rateSource: "compute",
      quantity: {
        source: "field",
        field: "quantity",
      },
    },
    {
      id: "storage",
      label: "Storage",
      rateSource: "storage",
      quantity: {
        source: "field",
        field: "storageSizeGb",
      },
      unit: "GB",
    },
  ],
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  catalogDefinition: {
    source: {
      displayName: "RDS",
      urlPath: "rds",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "computeTiers",
          path: "product.rds_rds.vm",
          fields: [
            {
              key: "engine",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "engineType",
                directMap: {
                  MySQL: "MySQL",
                  PostgreSQL: "PostgreSQL",
                },
                textPaths: ["engineType", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["mysql"], value: "MySQL" },
                  { keywords: ["postgresql"], value: "PostgreSQL" },
                ],
              },
            },
            {
              key: "version",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "dbVersion",
                directMap: {
                  dataInfo_57_: "8.0",
                  dataInfo_46_: "5.7",
                  dataInfo_78_: "17",
                  dataInfo_74_: "16",
                  dataInfo_73_: "15",
                  dataInfo_68_: "14",
                  dataInfo_67_: "13",
                },
                textPaths: ["dbVersion", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [],
              },
            },
            {
              key: "instanceType",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "instanceType",
                directMap: {
                  dataInfo_14_: "Primary/Standby",
                  dataInfo_15_: "Read replica",
                  dataInfo_16_: "Single",
                },
                textPaths: ["instanceType", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["primary/standby"], value: "Primary/Standby" },
                  { keywords: ["primary standby"], value: "Primary/Standby" },
                  { keywords: ["read replica"], value: "Read replica" },
                  { keywords: ["single"], value: "Single" },
                ],
              },
            },
            {
              key: "instanceClass",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "instanceClass",
                directMap: {
                  "General-purpose": "General-purpose",
                  Delicated: "Dedicated",
                },
                textPaths: ["instanceClass", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [],
              },
            },
            { key: "cpu", required: true, extractor: { kind: "number-from-pattern", paths: ["cpu"], pattern: "(\\d+(?:\\.\\d+)?)" } },
            { key: "memoryGiB", required: true, extractor: { kind: "memory-gib", paths: ["mem"] } },
            { key: "sizeLabel", extractor: { kind: "path-or-template", path: "sizeLabel", template: "{cpu} vCPUs, {memoryGiB} GB" } },
            { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode", template: "{engine}-{version}-{instanceType}-{instanceClass}-{cpu}-{memoryGiB}" } },
            { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
            { key: "productIds", extractor: { kind: "product-id-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
          ],
          dedupeBy: ["engine", "version", "instanceType", "instanceClass", "sizeLabel"],
          minByPath: "prices.ONDEMAND",
          sort: [
            { path: "engine", direction: "asc", order: ["MySQL", "PostgreSQL"] },
            { path: "version", direction: "asc", order: ["8.0", "5.7", "17", "16", "15", "14", "13"] },
            { path: "instanceType", direction: "asc", order: ["Primary/Standby", "Single", "Read replica"] },
            { path: "instanceClass", direction: "asc", order: ["General-purpose", "Dedicated"] },
            { path: "cpu", direction: "asc" },
            { path: "memoryGiB", direction: "asc" },
          ],
        },
        {
          targetPath: "storageTiers",
          path: "product.rds_rds.volume",
          fields: [
            {
              key: "engine",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "engineType",
                directMap: {
                  MySQL: "MySQL",
                  PostgreSQL: "PostgreSQL",
                },
                textPaths: ["engineType", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["mysql"], value: "MySQL" },
                  { keywords: ["postgresql"], value: "PostgreSQL" },
                ],
              },
            },
            {
              key: "instanceType",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "instanceType",
                directMap: {
                  dataInfo_14_: "Primary/Standby",
                  dataInfo_15_: "Read replica",
                  dataInfo_16_: "Single",
                },
                textPaths: ["instanceType", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["primary/standby"], value: "Primary/Standby" },
                  { keywords: ["primary standby"], value: "Primary/Standby" },
                  { keywords: ["read replica"], value: "Read replica" },
                  { keywords: ["single"], value: "Single" },
                ],
              },
            },
            {
              key: "storageType",
              required: true,
              extractor: {
                kind: "keyword-map",
                directPath: "volumeType",
                directMap: {
                  "Flexible SSD": "Flexible SSD",
                  "Flexible SSD throughput": "Flexible SSD",
                  "Flexible SSD IOPS": "Flexible SSD",
                  "Cloud SSD": "Cloud SSD",
                  ESSD: "Extreme SSD",
                  "Extreme SSD": "Extreme SSD",
                },
                textPaths: ["volumeType", "productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["flexible ssd"], value: "Flexible SSD" },
                  { keywords: ["cloud ssd"], value: "Cloud SSD" },
                  { keywords: ["essd"], value: "Extreme SSD" },
                  { keywords: ["extreme ssd"], value: "Extreme SSD" },
                ],
              },
            },
            {
              key: "resourceSpecCode",
              extractor: {
                kind: "conditional",
                when: [
                  { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "throughput" },
                  { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "iops" },
                ],
                then: { kind: "path-or-template", path: "resourceSpecCode", template: "{engine}-{instanceType}-{storageType}" },
                else: { kind: "literal", value: null },
              },
            },
            {
              key: "prices",
              extractor: {
                kind: "conditional",
                when: [
                  { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "throughput" },
                  { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "iops" },
                ],
                then: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
                else: { kind: "literal", value: {} },
              },
            },
            {
              key: "productIds",
              extractor: {
                kind: "conditional",
                when: [
                  { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "throughput" },
                  { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "iops" },
                ],
                then: { kind: "product-id-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] },
                else: { kind: "literal", value: {} },
              },
            },
            {
              key: "iopsRatePerUnit",
              extractor: {
                kind: "conditional",
                when: [{ kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "iops" }],
                then: { kind: "plan-amount", billingMode: "ONDEMAND" },
                else: { kind: "literal", value: null },
              },
            },
            {
              key: "throughputRatePerUnit",
              extractor: {
                kind: "conditional",
                when: [{ kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc", "volumeType"], value: "throughput" }],
                then: { kind: "plan-amount", billingMode: "ONDEMAND" },
                else: { kind: "literal", value: null },
              },
            },
          ],
          mergeBy: ["engine", "instanceType", "storageType"],
          sort: [
            { path: "engine", direction: "asc", order: ["MySQL", "PostgreSQL"] },
            { path: "instanceType", direction: "asc", order: ["Primary/Standby", "Single", "Read replica"] },
            { path: "storageType", direction: "asc", order: ["Flexible SSD", "Cloud SSD", "Extreme SSD"] },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "DB Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "rds-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "engineOptions", value: ifElse(ref("catalog"), call("listRdsEngines", ref("catalog")), []) },
      { key: "engine", value: call("resolveOption", ref("values.engine"), ref("derived.engineOptions"), ref("helpers.rdsDefaults.engine")) },
      {
        key: "versionOptions",
        value: ifElse(
          ref("catalog"),
          call("listRdsVersions", ref("catalog"), ref("derived.engine")),
          ifElse(eq(ref("derived.engine"), "MySQL"), ["8.0", "5.7"], ["17", "16", "15", "14", "13"]),
        ),
      },
      { key: "version", value: call("resolveOption", ref("values.version"), ref("derived.versionOptions"), ref("helpers.rdsDefaults.version")) },
      {
        key: "instanceTypeOptions",
        value: ifElse(
          ref("catalog"),
          call("listRdsInstanceTypes", ref("catalog"), { engine: ref("derived.engine"), version: ref("derived.version") }),
          ["Primary/Standby", "Single", "Read replica"],
        ),
      },
      { key: "instanceType", value: call("resolveOption", ref("values.instanceType"), ref("derived.instanceTypeOptions"), ref("helpers.rdsDefaults.instanceType")) },
      { key: "showSubAz", value: eq(ref("derived.instanceType"), "Primary/Standby") },
      { key: "subAz", value: "General AZ" },
      {
        key: "instanceClassOptions",
        value: ifElse(
          ref("catalog"),
          call("listRdsInstanceClasses", ref("catalog"), {
            engine: ref("derived.engine"),
            version: ref("derived.version"),
            instanceType: ref("derived.instanceType"),
          }),
          ["General-purpose", "Dedicated"],
        ),
      },
      {
        key: "instanceClass",
        value: call("resolveOption", ref("values.instanceClass"), ref("derived.instanceClassOptions"), ref("helpers.rdsDefaults.instanceClass")),
      },
      {
        key: "sizeOptions",
        value: ifElse(
          ref("catalog"),
          call("listRdsSizes", ref("catalog"), {
            engine: ref("derived.engine"),
            version: ref("derived.version"),
            instanceType: ref("derived.instanceType"),
            instanceClass: ref("derived.instanceClass"),
          }),
          [ref("helpers.rdsDefaults.size")],
        ),
      },
      { key: "size", value: call("resolveOption", ref("values.size"), ref("derived.sizeOptions"), ref("helpers.rdsDefaults.size")) },
      {
        key: "storageTypeOptions",
        value: ifElse(
          ref("catalog"),
          call("listRdsStorageTypes", ref("catalog"), { engine: ref("derived.engine"), instanceType: ref("derived.instanceType") }),
          ifElse(eq(ref("derived.instanceType"), "Read replica"), ["Cloud SSD", "Extreme SSD"], ["Flexible SSD", "Cloud SSD", "Extreme SSD"]),
        ),
      },
      {
        key: "storageType",
        value: call("resolveOption", ref("values.storageType"), ref("derived.storageTypeOptions"), ref("helpers.rdsDefaults.storageType")),
      },
      { key: "showIops", value: eq(ref("derived.storageType"), "Flexible SSD") },
      { key: "showThroughput", value: eq(ref("derived.storageType"), "Flexible SSD") },
      { key: "storageSizeGb", value: call("clampInteger", ref("values.storageSizeGb"), 40, 65536) },
      {
        key: "iops",
        value: ifElse(ref("derived.showIops"), call("clampInteger", ref("values.iops"), 3000, 100000), 3000),
      },
      {
        key: "throughputMibps",
        value: ifElse(ref("derived.showThroughput"), call("clampInteger", ref("values.throughputMibps"), 1, 100000), 128),
      },
      { key: "usageHours", value: call("clampInteger", ref("values.usageHours"), 1, 87600) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateRdsConfiguration", ref("catalog"), {
            engine: ref("derived.engine"),
            version: ref("derived.version"),
            instanceType: ref("derived.instanceType"),
            instanceClass: ref("derived.instanceClass"),
            size: ref("derived.size"),
            storageType: ref("derived.storageType"),
            storageSizeGb: ref("derived.storageSizeGb"),
            iops: ref("derived.iops"),
            throughputMibps: ref("derived.throughputMibps"),
            usageHours: ref("derived.usageHours"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      engine: ref("derived.engine"),
      version: ref("derived.version"),
      instanceType: ref("derived.instanceType"),
      subAz: ref("derived.subAz"),
      instanceClass: ref("derived.instanceClass"),
      size: ref("derived.size"),
      storageType: ref("derived.storageType"),
      storageSizeGb: ref("derived.storageSizeGb"),
      iops: ref("derived.iops"),
      throughputMibps: ref("derived.throughputMibps"),
      usageHours: ref("derived.usageHours"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      engine: { options: call("optionList", ref("derived.engineOptions")) },
      version: { options: call("optionList", ref("derived.versionOptions")) },
      instanceType: { options: call("optionList", ref("derived.instanceTypeOptions")) },
      subAz: { disabled: true },
      instanceClass: { options: call("optionList", ref("derived.instanceClassOptions")) },
      size: { options: call("optionList", ref("derived.sizeOptions")) },
      storageType: { options: call("optionList", ref("derived.storageTypeOptions")) },
      storageSizeGb: { min: 40, max: 65536, normalize: ref("derived.storageSizeGb") },
      iops: { min: 3000, normalize: ref("derived.iops") },
      throughputMibps: { min: 1, normalize: ref("derived.throughputMibps") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.usageHours") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "RDS pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected specifications:",
          template("{engine} {version}", {
            engine: ref("derived.engine"),
            version: ref("derived.version"),
          }),
          ref("derived.instanceType"),
          ifElse(ref("derived.showSubAz"), ref("derived.subAz"), null),
          ref("derived.instanceClass"),
          ref("derived.size"),
          template("{storageType} {storageSizeGb} GB", {
            storageType: ref("derived.storageType"),
            storageSizeGb: ref("derived.storageSizeGb"),
          }),
          ifElse(ref("derived.showIops"), template("{iops} IOPS", { iops: ref("derived.iops") }), null),
          ifElse(ref("derived.showThroughput"), template("{throughputMibps} MiB/s", { throughputMibps: ref("derived.throughputMibps") }), null),
          template("{usageHours}h", { usageHours: ref("derived.usageHours") }),
          template("{quantity} instance{suffix}", {
            quantity: ref("derived.quantity"),
            suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
          }),
          call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
        ],
      ),
      "Selected specifications:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call(
        "concatArrays",
        call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        [
          template("Monthly average: {avg}.", {
            avg: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo"),
          }),
        ],
        call("asArray", ref("derived.estimate.notes")),
        ifElse(eq(ref("derived.instanceType"), "Read replica"), ["You can only purchase read replicas after creating a primary DB instance."], []),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud RDS calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.rdsPricingReference.pricingUrl"),
        productUrl: ref("helpers.rdsPricingReference.productUrl"),
        calculatorApi: ref("helpers.rdsPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "rds",
        title: template("{service} {engine} {version} {size}", {
          service: ref("selectedService"),
          engine: ref("derived.engine"),
          version: ref("derived.version"),
          size: ref("derived.size"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Pay-per-use",
          engine: ref("derived.engine"),
          version: ref("derived.version"),
          instanceType: ref("derived.instanceType"),
          subAz: ifElse(ref("derived.showSubAz"), ref("derived.subAz"), null),
          instanceClass: ref("derived.instanceClass"),
          size: ref("derived.size"),
          storageType: ref("derived.storageType"),
          storageSizeGb: ref("derived.storageSizeGb"),
          iops: ifElse(ref("derived.showIops"), ref("derived.iops"), null),
          throughputMibps: ifElse(ref("derived.showThroughput"), ref("derived.throughputMibps"), null),
          usageHours: ref("derived.usageHours"),
          quantity: ref("derived.quantity"),
          computeResourceSpecCode: ref("derived.estimate.computeTier.resourceSpecCode"),
          computeProductId: coalesce(ref("derived.estimate.computeTier.productIds.ONDEMAND"), null),
          storageResourceSpecCode: ref("derived.estimate.storageTier.resourceSpecCode"),
          storageProductId: coalesce(ref("derived.estimate.storageTier.productIds.ONDEMAND"), null),
        },
        pricing: {
          total: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
          estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
          monthlyAverage: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo"),
          breakdown: call("byLabelAmount", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        },
      },
      null,
    ),
    hydrate: ifElse(
      and(eq(ref("product.productType"), "rds"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          engine: coalesce(ref("product.config.engine"), ref("helpers.rdsDefaults.engine")),
          version: coalesce(ref("product.config.version"), ref("helpers.rdsDefaults.version")),
          instanceType: coalesce(ref("product.config.instanceType"), ref("helpers.rdsDefaults.instanceType")),
          subAz: coalesce(ref("product.config.subAz"), ref("helpers.rdsDefaults.subAz")),
          instanceClass: coalesce(ref("product.config.instanceClass"), ref("helpers.rdsDefaults.instanceClass")),
          size: coalesce(ref("product.config.size"), ref("helpers.rdsDefaults.size")),
          storageType: coalesce(ref("product.config.storageType"), ref("helpers.rdsDefaults.storageType")),
          storageSizeGb: call("integerString", ref("product.config.storageSizeGb"), ref("helpers.rdsDefaults.storageSizeGb"), 40, 65536),
          iops: call("integerString", ref("product.config.iops"), ref("helpers.rdsDefaults.iops"), 3000, 100000),
          throughputMibps: call("integerString", ref("product.config.throughputMibps"), ref("helpers.rdsDefaults.throughputMibps"), 1, 100000),
          usageHours: call("integerString", ref("product.config.usageHours"), ref("helpers.rdsDefaults.usageHours"), 1, 87600),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.rdsDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: "Pay-per-use",
      },
      {
        handled: false,
        error: "This product cannot be edited from the calculator.",
      },
    ),
  },
} as const satisfies ConfigurableServiceBundleDefinition;
