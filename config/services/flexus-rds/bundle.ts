import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "flexus-rds",
  serviceCode: "Flexus RDS",
  serviceName: "Flexus RDS",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/RDSforMySQL.png",
  implementation: "configurable",
  billingOptions: ["Yearly/Monthly"],
  defaults: {
    engine: "MySQL",
    version: "8.0",
    instanceType: "Single",
    instanceClass: "Lightweight",
    size: "2 vCPUs, 4 GB",
    storageType: "Cloud SSD",
    storageSizeGb: 120,
    durationMonths: 1,
    quantity: 1,
  },
  fields: [
    { id: "engine", type: "select", label: "DB Engine", required: true, optionsSource: "catalog.engineOptions" },
    { id: "version", type: "select", label: "DB Engine Version", required: true, optionsSource: "catalog.versionOptions" },
    { id: "instanceType", type: "select", label: "DB Instance Type", required: true, optionsSource: "catalog.instanceTypeOptions" },
    { id: "instanceClass", type: "select", label: "DB Instance Class", required: true, options: ["Lightweight"] },
    { id: "size", type: "select", label: "Instance size", required: true, optionsSource: "catalog.sizeOptions" },
    { id: "storageType", type: "select", label: "Storage", required: true, options: ["Cloud SSD"] },
    { id: "storageSizeGb", type: "number", label: "Storage size", required: true, unit: "GB", min: 40, max: 65536, step: 10 },
    { id: "durationMonths", type: "select", label: "Required Duration", required: true, options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12] },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{engine} | {version} | {instanceType} | Lightweight | {size} | Cloud SSD",
    notes: [
      "This calculator models the lightweight Flexus RDS yearly/monthly flow from the Huawei hrds catalog.",
      "Storage is limited to Cloud SSD and the Lightweight class only.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "flexus-rds",
  serviceCode: "Flexus RDS",
  serviceName: "Flexus RDS",
  catalogAdapter: "flexus-rds",
  rateSources: {
    compute: {
      catalogKey: "computeTiers.prices",
      description: "Normalized Flexus RDS compute rates from the Huawei hrds calculator catalog.",
    },
    storage: {
      catalogKey: "storageTiers.prices",
      description: "Normalized Flexus RDS Cloud SSD storage rates from the Huawei hrds calculator catalog.",
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
      displayName: "Flexus RDS",
      urlPath: "hrds",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "computeTiers",
          path: "product.rds_rds.vm",
          filters: [
            { kind: "field-equals", path: "instanceClass", value: "HRDS" },
          ],
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
                textPaths: ["productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["primary/standby"], value: "Primary/Standby" },
                  { keywords: ["single"], value: "Single" },
                ],
              },
            },
            { key: "instanceClass", extractor: { kind: "literal", value: "Lightweight" } },
            { key: "cpu", required: true, extractor: { kind: "number-from-pattern", paths: ["cpu"], pattern: "(\\d+(?:\\.\\d+)?)" } },
            { key: "memoryGiB", required: true, extractor: { kind: "memory-gib", paths: ["mem"] } },
            { key: "sizeLabel", extractor: { kind: "path-or-template", path: "sizeLabel", template: "{cpu} vCPUs, {memoryGiB} GB" } },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "prices", extractor: { kind: "rate-set", modes: ["MONTHLY", "YEARLY"] } },
            { key: "productIds", extractor: { kind: "product-id-set", modes: ["MONTHLY", "YEARLY"] } },
          ],
          dedupeBy: ["engine", "instanceType", "sizeLabel"],
          minByPath: "prices.MONTHLY",
          sort: [
            { path: "engine", direction: "asc", order: ["MySQL", "PostgreSQL"] },
            { path: "instanceType", direction: "asc", order: ["Primary/Standby", "Single"] },
            { path: "cpu", direction: "asc" },
            { path: "memoryGiB", direction: "asc" },
          ],
        },
        {
          targetPath: "storageTiers",
          path: "product.rds_rds.volume",
          filters: [
            { kind: "field-equals", path: "volumeType", value: "Cloud SSD" },
          ],
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
                  dataInfo_16_: "Single",
                },
                textPaths: ["productSpecSysDesc", "resourceSpecCode"],
                mappings: [
                  { keywords: ["primary/standby"], value: "Primary/Standby" },
                  { keywords: ["single"], value: "Single" },
                ],
              },
            },
            { key: "storageType", extractor: { kind: "literal", value: "Cloud SSD" } },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "prices", extractor: { kind: "rate-set", modes: ["MONTHLY", "YEARLY"] } },
            { key: "productIds", extractor: { kind: "product-id-set", modes: ["MONTHLY", "YEARLY"] } },
          ],
          dedupeBy: ["engine", "instanceType", "storageType"],
          minByPath: "prices.MONTHLY",
          sort: [
            { path: "engine", direction: "asc", order: ["MySQL", "PostgreSQL"] },
            { path: "instanceType", direction: "asc", order: ["Primary/Standby", "Single"] },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "DB Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "flexus-rds-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "engineOptions", value: ifElse(ref("catalog"), call("listFlexusRdsEngines", ref("catalog")), []) },
      { key: "engine", value: call("resolveOption", ref("values.engine"), ref("derived.engineOptions"), ref("helpers.flexusRdsDefaults.engine")) },
      {
        key: "versionOptions",
        value: ifElse(eq(ref("derived.engine"), "MySQL"), ["8.0", "5.7"], ["12", "11", "10", "9.6", "9.5"]),
      },
      { key: "version", value: call("resolveOption", ref("values.version"), ref("derived.versionOptions"), ref("helpers.flexusRdsDefaults.version")) },
      {
        key: "instanceTypeOptions",
        value: ifElse(ref("catalog"), call("listFlexusRdsInstanceTypes", ref("catalog"), ref("derived.engine")), []),
      },
      { key: "instanceType", value: call("resolveOption", ref("values.instanceType"), ref("derived.instanceTypeOptions"), ref("helpers.flexusRdsDefaults.instanceType")) },
      { key: "instanceClass", value: "Lightweight" },
      {
        key: "sizeOptions",
        value: ifElse(
          ref("catalog"),
          call("listFlexusRdsSizes", ref("catalog"), { engine: ref("derived.engine"), instanceType: ref("derived.instanceType") }),
          ifElse(eq(ref("derived.instanceType"), "Single"), ["2 vCPUs, 4 GB", "2 vCPUs, 8 GB", "4 vCPUs, 8 GB"], ["2 vCPUs, 4 GB"]),
        ),
      },
      { key: "size", value: call("resolveOption", ref("values.size"), ref("derived.sizeOptions"), ref("helpers.flexusRdsDefaults.size")) },
      { key: "storageType", value: "Cloud SSD" },
      { key: "storageSizeGb", value: call("clampInteger", ref("values.storageSizeGb"), 40, 65536) },
      { key: "durationMonthOptions", value: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12] },
      { key: "durationMonths", value: call("resolveNumberOption", ref("values.durationMonths"), ref("derived.durationMonthOptions"), ref("helpers.flexusRdsDefaults.durationMonths")) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateFlexusRdsConfiguration", ref("catalog"), {
            engine: ref("derived.engine"),
            version: ref("derived.version"),
            instanceType: ref("derived.instanceType"),
            instanceClass: "Lightweight",
            size: ref("derived.size"),
            storageType: "Cloud SSD",
            storageSizeGb: ref("derived.storageSizeGb"),
            durationMonths: ref("derived.durationMonths"),
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
      instanceClass: "Lightweight",
      size: ref("derived.size"),
      storageType: "Cloud SSD",
      storageSizeGb: ref("derived.storageSizeGb"),
      durationMonths: ref("derived.durationMonths"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      engine: { options: call("optionList", ref("derived.engineOptions")) },
      version: { options: call("optionList", ref("derived.versionOptions")) },
      instanceType: { options: call("optionList", ref("derived.instanceTypeOptions")) },
      instanceClass: { disabled: true },
      size: { options: call("optionList", ref("derived.sizeOptions")) },
      storageType: { disabled: true },
      storageSizeGb: { min: 40, max: 65536, normalize: ref("derived.storageSizeGb") },
      durationMonths: { options: call("optionList", ref("derived.durationMonthOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Flexus RDS pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected specifications:",
          ref("derived.engine"),
          ref("derived.version"),
          ref("derived.instanceType"),
          "Lightweight",
          ref("derived.size"),
          template("Cloud SSD {storageSizeGb} GB", { storageSizeGb: ref("derived.storageSizeGb") }),
          ifElse(eq(ref("derived.durationMonths"), 12), "1yr", template("{months}mo", { months: ref("derived.durationMonths") })),
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
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud Flexus RDS calculator API for {region}. Sources: {pricingUrl} and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.flexusRdsPricingReference.pricingUrl"),
        calculatorApi: ref("helpers.flexusRdsPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "flexus-rds",
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
          billingMode: "Yearly/Monthly",
          engine: ref("derived.engine"),
          version: ref("derived.version"),
          instanceType: ref("derived.instanceType"),
          instanceClass: "Lightweight",
          size: ref("derived.size"),
          storageType: "Cloud SSD",
          storageSizeGb: ref("derived.storageSizeGb"),
          durationMonths: ref("derived.durationMonths"),
          quantity: ref("derived.quantity"),
          computeResourceSpecCode: ref("derived.estimate.computeTier.resourceSpecCode"),
          computeProductId: ifElse(
            eq(ref("derived.durationMonths"), 12),
            coalesce(ref("derived.estimate.computeTier.productIds.YEARLY"), null),
            coalesce(ref("derived.estimate.computeTier.productIds.MONTHLY"), null),
          ),
          storageResourceSpecCode: ref("derived.estimate.storageTier.resourceSpecCode"),
          storageProductId: ifElse(
            eq(ref("derived.durationMonths"), 12),
            coalesce(ref("derived.estimate.storageTier.productIds.YEARLY"), null),
            coalesce(ref("derived.estimate.storageTier.productIds.MONTHLY"), null),
          ),
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
      and(eq(ref("product.productType"), "flexus-rds"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          engine: coalesce(ref("product.config.engine"), ref("helpers.flexusRdsDefaults.engine")),
          version: coalesce(ref("product.config.version"), ref("helpers.flexusRdsDefaults.version")),
          instanceType: coalesce(ref("product.config.instanceType"), ref("helpers.flexusRdsDefaults.instanceType")),
          instanceClass: "Lightweight",
          size: coalesce(ref("product.config.size"), ref("helpers.flexusRdsDefaults.size")),
          storageType: "Cloud SSD",
          storageSizeGb: call("integerString", ref("product.config.storageSizeGb"), ref("helpers.flexusRdsDefaults.storageSizeGb"), 40, 65536),
          durationMonths: call("resolveNumberOption", ref("product.config.durationMonths"), [1, 2, 3, 4, 5, 6, 7, 8, 9, 12], ref("helpers.flexusRdsDefaults.durationMonths")),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.flexusRdsDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: "Yearly/Monthly",
      },
      {
        handled: false,
        error: "This product cannot be edited from the calculator.",
      },
    ),
  },
} as const satisfies ConfigurableServiceBundleDefinition;
