import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "dds",
    serviceCode: "DDS",
    serviceName: "Document Database Service",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DDS.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      dbType: "Replica set",
      specification: "2 vCPUs | 4 GB",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "dbType", type: "select", label: "DB Instance Type", required: true, optionsSource: "catalog.dbTypes" },
      { id: "specification", type: "select", label: "Specification", required: true, optionsSource: "catalog.specifications" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{dbType} | {specification} | {quantity} PCS",
      notes: [
        "DDS pricing is based on instance type, specification, and billing mode.",
        "Only General-purpose and Enhanced II specifications are included.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "dds",
    serviceCode: "DDS",
    serviceName: "Document Database Service",
    catalogAdapter: "dds",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "DDS instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "ddsInstance",
        label: "DDS instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "DDS",
      urlPath: "dds",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "field-equals", path: "resourceType", value: "hws.resource.type.dds.vm" },
      ],
      fields: [
        {
          key: "dbType",
          required: true,
          extractor: {
            kind: "keyword-map",
            directPath: "dbType",
            directMap: {
              replica: "Replica set",
              cluster: "Cluster",
              shard: "Shard",
              mongos: "Mongos",
              config: "Config",
              readonly: "Readonly",
            },
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "dbType"],
            mappings: [
              { keywords: ["replica", "rr", "repset"], value: "Replica set" },
              { keywords: ["cluster"], value: "Cluster" },
              { keywords: ["shard"], value: "Shard" },
              { keywords: ["mongos"], value: "Mongos" },
              { keywords: ["config"], value: "Config" },
              { keywords: ["readonly"], value: "Readonly" },
            ],
          },
        },
        {
          key: "vCpus",
          extractor: { kind: "number-from-pattern", paths: ["productSpecSysDesc", "cpu"], pattern: "(\\d+)\\s*(?:vcpu|vcpus|core)", divideBy: 1 },
        },
        {
          key: "memoryGb",
          extractor: { kind: "number-from-pattern", paths: ["productSpecSysDesc", "mem"], pattern: "(\\d+)\\s*(?:GB|gb|GiB)", divideBy: 1 },
        },
        {
          key: "specification",
          extractor: { kind: "path-or-template", path: "spec", template: "{vCpus} vCPUs | {memoryGb} GB" },
        },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
        { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
        { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
      ],
      dedupeBy: ["dbType", "specification"],
      minByPath: "prices.ONDEMAND",
      sort: [
        { path: "dbType", direction: "asc" },
        { path: "vCpus", direction: "asc" },
        { path: "memoryGb", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "dds-pricing" },
    showSharedUsageHours: false,
    derived: [
      {
        key: "dbTypeOptions",
        value: ifElse(ref("catalog"), call("listDdsDbTypes", ref("catalog")), []),
      },
      { key: "dbType", value: call("resolveOption", ref("values.dbType"), ref("derived.dbTypeOptions"), ref("helpers.ddsDefaults.dbType")) },
      {
        key: "specificationOptions",
        value: ifElse(
          ref("catalog"),
          call("listDdsSpecifications", ref("catalog"), ref("derived.dbType")),
          ["2 vCPUs | 4 GB", "2 vCPUs | 8 GB", "4 vCPUs | 8 GB", "4 vCPUs | 16 GB", "8 vCPUs | 16 GB", "8 vCPUs | 32 GB"],
        ),
      },
      { key: "specification", value: call("resolveOption", ref("values.specification"), ref("derived.specificationOptions"), ref("helpers.ddsDefaults.specification")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "ddsUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDdsConfiguration", ref("catalog"), {
            dbType: ref("derived.dbType"),
            specification: ref("derived.specification"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.ddsUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      dbType: ref("derived.dbType"),
      specification: ref("derived.specification"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.ddsUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      dbType: { options: call("optionList", ref("derived.dbTypeOptions")) },
      specification: { options: call("optionList", ref("derived.specificationOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.ddsUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "DDS pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.dbType"),
          ref("derived.specification"),
          template("{quantity} instance{suffix}", {
            quantity: ref("derived.quantity"),
            suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
          }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.ddsUsageHoursValue") }), null),
          call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
        ],
      ),
      "Selected:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call(
        "concatArrays",
        call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        [template("Monthly average: {avg}.", { avg: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo") })],
        call("asArray", ref("derived.estimate.notes")),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud DDS calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.ddsPricingReference.pricingUrl"),
        productUrl: ref("helpers.ddsPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "dds",
        title: template("{service} {dbType} {specification}", {
          service: ref("selectedService"),
          dbType: ref("derived.dbType"),
          specification: ref("derived.specification"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          dbType: ref("derived.dbType"),
          specification: ref("derived.specification"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.ddsUsageHoursValue"), null),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.productId"),
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
      and(eq(ref("product.productType"), "dds"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          dbType: coalesce(ref("product.config.dbType"), ref("helpers.ddsDefaults.dbType")),
          specification: coalesce(ref("product.config.specification"), ref("helpers.ddsDefaults.specification")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.ddsDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.ddsDefaults.usageHours")),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: coalesce(ref("product.config.billingMode"), ref("billingMode")),
      },
      {
        handled: false,
        error: "This product cannot be edited from the calculator.",
      },
    ),
  },
} as const satisfies ConfigurableServiceBundleDefinition;

export const serviceDefinition = configurableServiceBundle.service;
export const pricingDefinition = configurableServiceBundle.pricing;
