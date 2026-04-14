import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "dms",
    serviceCode: "DMS",
    serviceName: "DMS Kafka",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/DMS.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      flavor: "kafka.2u4g.cluster.small",
      brokers: 3,
      bandwidth: "100MB/s",
      storageType: "Ultra-high I/O",
      storageGb: 100,
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "flavor", type: "select", label: "Flavor", required: true, optionsSource: "catalog.flavors" },
      { id: "brokers", type: "number", label: "Brokers", required: true, min: 1, step: 1 },
      { id: "bandwidth", type: "select", label: "Bandwidth", required: true, optionsSource: "catalog.bandwidths" },
      { id: "storageType", type: "select", label: "Storage Type", required: true, optionsSource: "catalog.storageTypes" },
      { id: "storageGb", type: "number", label: "Storage Space per Broker", required: true, unit: "GB", min: 1, step: 10 },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24 },
    ],
    summary: {
      selectionTemplate: "{flavor} | {brokers} brokers | {bandwidth} | {storageType} {storageGb} GB",
      notes: [
        "DMS Kafka pricing includes flavor (instance), bandwidth, and storage per broker.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "dms",
    serviceCode: "DMS",
    serviceName: "DMS Kafka",
    catalogAdapter: "dms",
    rateSources: {
      flavor: {
        catalogKey: "flavors.prices",
        description: "DMS Kafka platinum instance flavor rates.",
      },
      bandwidth: {
        catalogKey: "bandwidths.prices",
        description: "DMS Kafka bandwidth rates.",
      },
      storage: {
        catalogKey: "storageTypes.prices",
        description: "DMS Kafka storage per-GB rates.",
      },
    },
    metrics: [
      {
        id: "dmsFlavor",
        label: "DMS Kafka flavor",
        rateSource: "flavor",
        quantity: { source: "field", field: "brokers" },
      },
      {
        id: "dmsBandwidth",
        label: "DMS Kafka bandwidth",
        rateSource: "bandwidth",
        quantity: { source: "field", field: "quantity" },
      },
      {
        id: "dmsStorage",
        label: "DMS Kafka storage",
        rateSource: "storage",
        quantity: { source: "field", field: "storageGb" },
        unit: "GB",
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "DMS",
      urlPath: "kafka",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "flavors",
          path: "product.dms_dms.platinum",
          filters: [],
          fields: [
            {
              key: "flavor",
              required: true,
              extractor: { kind: "keyword-map", textPaths: ["specId", "productSpecSysDesc", "resourceSpecCode"], mappings: [
                { keywords: ["2u4g", "cluster.small"], value: "kafka.2u4g.cluster.small" },
                { keywords: ["2u4g"], value: "kafka.2u4g.cluster" },
                { keywords: ["4u8g"], value: "kafka.4u8g.cluster" },
                { keywords: ["8u16g"], value: "kafka.8u16g.cluster" },
                { keywords: ["12u24g"], value: "kafka.12u24g.cluster" },
                { keywords: ["16u32g"], value: "kafka.16u32g.cluster" },
              ] },
            },
            {
              key: "label",
              required: true,
              extractor: { kind: "keyword-map", textPaths: ["specId", "productSpecSysDesc", "resourceSpecCode"], mappings: [
                { keywords: ["2u4g", "cluster.small"], value: "kafka.2u4g.cluster.small" },
                { keywords: ["2u4g"], value: "kafka.2u4g.cluster" },
                { keywords: ["4u8g"], value: "kafka.4u8g.cluster" },
                { keywords: ["8u16g"], value: "kafka.8u16g.cluster" },
                { keywords: ["12u24g"], value: "kafka.12u24g.cluster" },
                { keywords: ["16u32g"], value: "kafka.16u32g.cluster" },
              ] },
            },
            { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
            { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
            { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
            { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
          ],
          dedupeBy: ["flavor"],
          minByPath: "prices.ONDEMAND",
          sort: [
            { path: "flavor", direction: "asc", order: ["kafka.2u4g.cluster.small", "kafka.2u4g.cluster", "kafka.4u8g.cluster", "kafka.8u16g.cluster", "kafka.12u24g.cluster", "kafka.16u32g.cluster"] },
          ],
        },
        {
          targetPath: "bandwidths",
          path: "product.dms_dms.instance",
          filters: [
            { kind: "text-excludes", paths: ["resourceSpecCode"], value: ".platinum" },
            { kind: "text-excludes", paths: ["resourceSpecCode"], value: ".storage" },
            { kind: "text-excludes", paths: ["resourceSpecCode"], value: ".dec" },
          ],
          fields: [
            {
              key: "bandwidth",
              required: true,
              extractor: { kind: "keyword-map", textPaths: ["type", "datastoresize", "productSpecSysDesc", "resourceSpecCode"], mappings: [
                { keywords: ["100"], value: "100MB/s" },
                { keywords: ["300"], value: "300MB/s" },
                { keywords: ["600"], value: "600MB/s" },
                { keywords: ["1200"], value: "1200MB/s" },
              ] },
            },
            {
              key: "label",
              required: true,
              extractor: { kind: "keyword-map", textPaths: ["type", "datastoresize", "productSpecSysDesc", "resourceSpecCode"], mappings: [
                { keywords: ["100"], value: "100 MB/s" },
                { keywords: ["300"], value: "300 MB/s" },
                { keywords: ["600"], value: "600 MB/s" },
                { keywords: ["1200"], value: "1200 MB/s" },
              ] },
            },
            {
              key: "bandwidthMbps",
              required: true,
              extractor: { kind: "number-from-pattern", paths: ["type", "datastoresize", "productSpecSysDesc", "resourceSpecCode"], pattern: "(\\d+)" },
            },
            { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
            { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
            { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
            { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
          ],
          dedupeBy: ["bandwidth"],
          minByPath: "prices.ONDEMAND",
          sort: [
            { path: "bandwidthMbps", direction: "asc" },
          ],
        },
        {
          targetPath: "storageTypes",
          path: "product.dms_dms.storage",
          filters: [],
          fields: [
            {
              key: "storageType",
              required: true,
              extractor: { kind: "keyword-map", textPaths: ["type", "productSpecSysDesc", "resourceSpecCode"], mappings: [
                { keywords: ["extreme"], value: "Extreme SSD" },
                { keywords: ["ultra"], value: "Ultra-high I/O" },
                { keywords: ["general"], value: "General Purpose SSD" },
                { keywords: ["high"], value: "High I/O" },
              ] },
            },
            {
              key: "label",
              required: true,
              extractor: { kind: "keyword-map", textPaths: ["type", "productSpecSysDesc", "resourceSpecCode"], mappings: [
                { keywords: ["extreme"], value: "Extreme SSD" },
                { keywords: ["ultra"], value: "Ultra-high I/O" },
                { keywords: ["general"], value: "General Purpose SSD" },
                { keywords: ["high"], value: "High I/O" },
              ] },
            },
            { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
            { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
            { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
            { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
          ],
          dedupeBy: ["storageType"],
          minByPath: "prices.ONDEMAND",
          sort: [
            { path: "storageType", direction: "asc", order: ["Extreme SSD", "Ultra-high I/O", "General Purpose SSD", "High I/O"] },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "dms-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "flavorOptions", value: ifElse(ref("catalog"), call("listDmsFlavors", ref("catalog"), ref("billingMode")), []) },
      { key: "flavor", value: call("resolveOption", ref("values.flavor"), ref("derived.flavorOptions"), ref("helpers.dmsDefaults.flavor")) },
      { key: "brokers", value: max(1, call("clampInteger", ref("values.brokers"), 1)) },
      { key: "bandwidthOptions", value: ifElse(ref("catalog"), call("listDmsBandwidths", ref("catalog"), ref("billingMode")), []) },
      { key: "bandwidth", value: call("resolveOption", ref("values.bandwidth"), ref("derived.bandwidthOptions"), ref("helpers.dmsDefaults.bandwidth")) },
      { key: "storageTypeOptions", value: ifElse(ref("catalog"), call("listDmsStorageTypes", ref("catalog"), ref("billingMode")), []) },
      { key: "storageType", value: call("resolveOption", ref("values.storageType"), ref("derived.storageTypeOptions"), ref("helpers.dmsDefaults.storageType")) },
      { key: "storageGb", value: max(1, call("clampInteger", ref("values.storageGb"), 1)) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "dmsUsageHoursValue", value: ifElse(eq(ref("billingMode"), "Pay-per-use"), max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)), null) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDmsConfiguration", ref("catalog"), {
            flavor: ref("derived.flavor"),
            brokers: ref("derived.brokers"),
            bandwidth: ref("derived.bandwidth"),
            storageType: ref("derived.storageType"),
            storageGb: ref("derived.storageGb"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.dmsUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      flavor: ref("derived.flavor"),
      brokers: ref("derived.brokers"),
      bandwidth: ref("derived.bandwidth"),
      storageType: ref("derived.storageType"),
      storageGb: ref("derived.storageGb"),
      quantity: ref("derived.quantity"),
      usageHours: coalesce(ref("derived.dmsUsageHoursValue"), ref("helpers.dmsDefaults.usageHours")),
    },
    visibilityContext: {},
    fieldRuntime: {
      flavor: { options: call("optionList", ref("derived.flavorOptions")) },
      brokers: { min: 1, normalize: ref("derived.brokers") },
      bandwidth: { options: call("optionList", ref("derived.bandwidthOptions")) },
      storageType: { options: call("optionList", ref("derived.storageTypeOptions")) },
      storageGb: { min: 1, normalize: ref("derived.storageGb") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: coalesce(ref("derived.dmsUsageHoursValue"), ref("helpers.dmsDefaults.usageHours")) },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "DMS Kafka pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.flavor"),
          template("{brokers} broker{suffix}", {
            brokers: ref("derived.brokers"),
            suffix: ifElse(eq(ref("derived.brokers"), 1), "", "s"),
          }),
          ref("derived.bandwidth"),
          template("{storageType} {gb} GB", {
            storageType: ref("derived.storageType"),
            gb: ref("derived.storageGb"),
          }),
          ifElse(
            eq(ref("derived.estimate.billingMode"), "Pay-per-use"),
            template("{hours}h", { hours: ref("derived.dmsUsageHoursValue") }),
            ref("derived.estimate.suffix"),
          ),
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
        ifElse(
          eq(ref("derived.estimate.billingMode"), "Pay-per-use"),
          [template("Monthly average: {avg}.", { avg: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo") })],
          [],
        ),
        call("asArray", ref("derived.estimate.notes")),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud DMS Kafka calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.dmsPricingReference.pricingUrl"),
        productUrl: ref("helpers.dmsPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "dms",
        title: template("{service} {flavor}", {
          service: ref("selectedService"),
          flavor: ref("derived.flavor"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          flavor: ref("derived.flavor"),
          brokers: ref("derived.brokers"),
          bandwidth: ref("derived.bandwidth"),
          storageType: ref("derived.storageType"),
          storageGb: ref("derived.storageGb"),
          quantity: ref("derived.quantity"),
          usageHours: ref("derived.dmsUsageHoursValue"),
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
      and(eq(ref("product.productType"), "dms"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          flavor: coalesce(ref("product.config.flavor"), ref("helpers.dmsDefaults.flavor")),
          brokers: coalesce(ref("product.config.brokers"), ref("helpers.dmsDefaults.brokers")),
          bandwidth: coalesce(ref("product.config.bandwidth"), ref("helpers.dmsDefaults.bandwidth")),
          storageType: coalesce(ref("product.config.storageType"), ref("helpers.dmsDefaults.storageType")),
          storageGb: coalesce(ref("product.config.storageGb"), ref("helpers.dmsDefaults.storageGb")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.dmsDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.dmsDefaults.usageHours")),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
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
