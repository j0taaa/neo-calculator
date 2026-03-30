import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { DeclarativeRuntimeDefinition } from "@/lib/declarative-service-runtime-types";
import { convertLegacyRuntimeDefinition } from "@/lib/legacy-runtime-converter";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";

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

const legacyRuntimeDefinition = {
  quantityLabel: "DB Instance",
  showGlobalQuantityControl: false,
  usesSharedBillingHeader: true,
  catalog: { route: "rds-pricing" },
  showSharedUsageHoursExpression: "false",
  catalogViewExpression: `(() => {
    const engineOptions = catalog ? helpers.listRdsEngines(catalog) : ['MySQL', 'PostgreSQL'];
    const engine = engineOptions.includes(values.engine) ? values.engine : helpers.rdsDefaults.engine;
    const versionOptions = catalog ? helpers.listRdsVersions(catalog, engine) : (engine === 'MySQL' ? ['8.0', '5.7'] : ['17', '16', '15', '14', '13']);
    const version = versionOptions.includes(values.version) ? values.version : (versionOptions[0] ?? helpers.rdsDefaults.version);
    const instanceTypeOptions = catalog ? helpers.listRdsInstanceTypes(catalog, { engine, version }) : ['Primary/Standby', 'Single', 'Read replica'];
    const instanceType = instanceTypeOptions.includes(values.instanceType) ? values.instanceType : (instanceTypeOptions[0] ?? helpers.rdsDefaults.instanceType);
    const showSubAz = instanceType === 'Primary/Standby';
    const subAz = 'General AZ';
    const instanceClassOptions = catalog ? helpers.listRdsInstanceClasses(catalog, { engine, version, instanceType }) : ['General-purpose', 'Dedicated'];
    const instanceClass = instanceClassOptions.includes(values.instanceClass) ? values.instanceClass : (instanceClassOptions[0] ?? helpers.rdsDefaults.instanceClass);
    const sizeOptions = catalog ? helpers.listRdsSizes(catalog, { engine, version, instanceType, instanceClass }) : [helpers.rdsDefaults.size];
    const size = sizeOptions.includes(values.size) ? values.size : (sizeOptions[0] ?? helpers.rdsDefaults.size);
    const storageTypeOptions = catalog ? helpers.listRdsStorageTypes(catalog, { engine, instanceType }) : (instanceType === 'Read replica' ? ['Cloud SSD', 'Extreme SSD'] : ['Flexible SSD', 'Cloud SSD', 'Extreme SSD']);
    const storageType = storageTypeOptions.includes(values.storageType) ? values.storageType : (storageTypeOptions[0] ?? helpers.rdsDefaults.storageType);
    const showIops = storageType === 'Flexible SSD';
    const showThroughput = storageType === 'Flexible SSD';
    const storageSizeGb = helpers.clampInteger(values.storageSizeGb || 40, 40, 65536);
    const iops = showIops ? helpers.clampInteger(values.iops || 3000, 3000, 100000) : 3000;
    const throughputMibps = showThroughput ? helpers.clampInteger(values.throughputMibps || 128, 1, 100000) : 128;
    const usageHours = helpers.clampInteger(values.usageHours || 744, 1, 87600);
    const quantity = helpers.clampInteger(values.quantity || 1, 1);
    const estimate = catalog ? helpers.estimateRdsConfiguration(catalog, { engine, version, instanceType, instanceClass, size, storageType, storageSizeGb, iops, throughputMibps, usageHours, quantity }) : null;
    return { engineOptions, engine, versionOptions, version, instanceTypeOptions, instanceType, showSubAz, subAz, instanceClassOptions, instanceClass, sizeOptions, size, storageTypeOptions, storageType, showIops, iops, showThroughput, throughputMibps, storageSizeGb, usageHours, quantity, estimate };
  })()`,
  syncValuesExpression: `({
    engine: catalogView.engine,
    version: catalogView.version,
    instanceType: catalogView.instanceType,
    subAz: catalogView.subAz,
    instanceClass: catalogView.instanceClass,
    size: catalogView.size,
    storageType: catalogView.storageType,
    storageSizeGb: String(catalogView.storageSizeGb),
    iops: String(catalogView.iops),
    throughputMibps: String(catalogView.throughputMibps),
    usageHours: String(catalogView.usageHours),
    quantity: String(catalogView.quantity),
  })`,
  fieldRuntime: {
    engine: { optionsExpression: "helpers.optionList(catalogView.engineOptions)" },
    version: { optionsExpression: "helpers.optionList(catalogView.versionOptions)" },
    instanceType: { optionsExpression: "helpers.optionList(catalogView.instanceTypeOptions)" },
    subAz: { disabledExpression: "true" },
    instanceClass: { optionsExpression: "helpers.optionList(catalogView.instanceClassOptions)" },
    size: { optionsExpression: "helpers.optionList(catalogView.sizeOptions)" },
    storageType: { optionsExpression: "helpers.optionList(catalogView.storageTypeOptions)" },
    storageSizeGb: { minExpression: "40", maxExpression: "65536", normalizeExpression: "helpers.clampInteger(values.storageSizeGb || 40, 40, 65536)" },
    iops: { minExpression: "3000", normalizeExpression: "helpers.clampInteger(values.iops || 3000, 3000, 100000)" },
    throughputMibps: { minExpression: "1", normalizeExpression: "helpers.clampInteger(values.throughputMibps || 128, 1, 100000)" },
    usageHours: { minExpression: "1", maxExpression: "87600", normalizeExpression: "helpers.clampInteger(values.usageHours || 744, 1, 87600)" },
    quantity: { minExpression: "1", normalizeExpression: "helpers.clampInteger(values.quantity || 1, 1)" },
  },
  estimateExpression: "catalogView.estimate",
  addToListErrorExpression: "catalogView.estimate ? null : (pricingError || 'RDS pricing is unavailable for the current selection.')",
  selectionSummaryExpression: "`Selected specifications: ${catalogView.engine} ${catalogView.version} | ${catalogView.instanceType}${catalogView.showSubAz ? ` | ${catalogView.subAz}` : ''} | ${catalogView.instanceClass} | ${catalogView.size} | ${catalogView.storageType} ${catalogView.storageSizeGb} GB${catalogView.showIops ? ` | ${catalogView.iops} IOPS` : ''}${catalogView.showThroughput ? ` | ${catalogView.throughputMibps} MiB/s` : ''} | ${catalogView.usageHours}h | ${catalogView.quantity} instance${catalogView.quantity === 1 ? '' : 's'}${catalogView.estimate ? ` | ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix)}` : ''}`",
  selectionNotesExpression: "catalogView.estimate ? [...helpers.formatBreakdownNotes(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown), `Monthly average: ${helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo')}.`, ...helpers.asArray(catalogView.estimate.notes), ...(catalogView.instanceType === 'Read replica' ? ['You can only purchase read replicas after creating a primary DB instance.'] : [])] : []",
  referenceNoteExpression: "`Pricing sourced from Huawei Cloud RDS calculator API for ${catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue)}. Sources: ${helpers.rdsPricingReference.pricingUrl}, ${helpers.rdsPricingReference.productUrl}, and ${helpers.rdsPricingReference.calculatorApi}`",
  buildRequestBodiesExpression: `catalogView.estimate ? ({
    serviceCode: selectedServiceCode,
    serviceName: selectedService,
    productType: 'rds',
    title: \`\${selectedService} \${catalogView.engine} \${catalogView.version} \${catalogView.size}\`,
    quantity: 1,
    config: {
      region: regionValue,
      catalogRegionId: catalogRegionId ?? (helpers.huaweiRegions[regionValue].catalogRegionId ?? regionValue),
      billingMode: 'Pay-per-use',
      engine: catalogView.engine,
      version: catalogView.version,
      instanceType: catalogView.instanceType,
      subAz: catalogView.showSubAz ? catalogView.subAz : null,
      instanceClass: catalogView.instanceClass,
      size: catalogView.size,
      storageType: catalogView.storageType,
      storageSizeGb: catalogView.storageSizeGb,
      iops: catalogView.showIops ? catalogView.iops : null,
      throughputMibps: catalogView.showThroughput ? catalogView.throughputMibps : null,
      usageHours: catalogView.usageHours,
      quantity: catalogView.quantity,
      computeResourceSpecCode: catalogView.estimate.computeTier.resourceSpecCode,
      computeProductId: catalogView.estimate.computeTier.productIds.ONDEMAND ?? null,
      storageResourceSpecCode: catalogView.estimate.storageTier.resourceSpecCode,
      storageProductId: catalogView.estimate.storageTier.productIds.ONDEMAND ?? null,
    },
    pricing: {
      total: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
      estimate: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.amount, catalogView.estimate.suffix),
      monthlyAverage: helpers.formatFlavorAmount(catalogView.estimate.currency, catalogView.estimate.monthlyAverageAmount, '/mo'),
      breakdown: helpers.byLabelAmount(catalogView.estimate.currency, catalogView.estimate.suffix, catalogView.estimate.breakdown),
    },
  }) : null`,
  hydrateExpression: `(() => {
    if (product.productType !== 'rds' || !helpers.isRecord(product.config)) {
      return { handled: false, error: 'This product cannot be edited from the calculator.' };
    }
    return {
      handled: true,
      values: {
        engine: typeof product.config.engine === 'string' ? product.config.engine : helpers.rdsDefaults.engine,
        version: typeof product.config.version === 'string' ? product.config.version : helpers.rdsDefaults.version,
        instanceType: typeof product.config.instanceType === 'string' ? product.config.instanceType : helpers.rdsDefaults.instanceType,
        subAz: typeof product.config.subAz === 'string' ? product.config.subAz : helpers.rdsDefaults.subAz,
        instanceClass: typeof product.config.instanceClass === 'string' ? product.config.instanceClass : helpers.rdsDefaults.instanceClass,
        size: typeof product.config.size === 'string' ? product.config.size : helpers.rdsDefaults.size,
        storageType: typeof product.config.storageType === 'string' ? product.config.storageType : helpers.rdsDefaults.storageType,
        storageSizeGb: typeof product.config.storageSizeGb === 'number' ? String(Math.max(40, Math.floor(product.config.storageSizeGb))) : String(helpers.rdsDefaults.storageSizeGb),
        iops: typeof product.config.iops === 'number' ? String(Math.max(3000, Math.floor(product.config.iops))) : String(helpers.rdsDefaults.iops),
        throughputMibps: typeof product.config.throughputMibps === 'number' ? String(Math.max(1, Math.floor(product.config.throughputMibps))) : String(helpers.rdsDefaults.throughputMibps),
        usageHours: typeof product.config.usageHours === 'number' ? String(Math.max(1, Math.floor(product.config.usageHours))) : String(helpers.rdsDefaults.usageHours),
        quantity: typeof product.config.quantity === 'number' ? String(Math.max(1, Math.floor(product.config.quantity))) : String(helpers.rdsDefaults.quantity),
      },
      nextRegion: typeof product.config.region === 'string' ? product.config.region : regionValue,
      nextBillingMode: 'Pay-per-use',
    };
  })()`,
} satisfies DeclarativeRuntimeDefinition;

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
  runtime: convertLegacyRuntimeDefinition(legacyRuntimeDefinition),
} as const satisfies ConfigurableServiceBundleDefinition;
