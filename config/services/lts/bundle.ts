import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "lts",
  serviceCode: "LTS",
  serviceName: "Log Tank Service",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/LTS.png",
  implementation: "configurable",
  billingOptions: ["Pay-per-use"],
  defaults: {
    rawLogSizeGb: 10,
    intelligentColdStorage: false,
    logStorageDurationDays: 7,
    indexFieldRatio: 100,
    dailyBasicTransferVolumeGb: 0,
    dailyAdvancedTransferVolumeGb: 0,
    usageHours: 744,
    quantity: 1,
  },
  fields: [
    { id: "rawLogSizeGb", type: "number", label: "Raw Log Size", required: true, unit: "GB/day", min: 0, step: 1, inputMode: "decimal" },
    { id: "intelligentColdStorage", type: "checkbox", label: "Intelligent Cold Storage" },
    { id: "logStorageDurationDays", type: "number", label: "Log Storage Duration", required: true, unit: "day", min: 1, step: 1 },
    { id: "indexFieldRatio", type: "number", label: "Index Field Ratio", required: true, unit: "%", min: 0, max: 100, step: 1, inputMode: "decimal" },
    { id: "dailyBasicTransferVolumeGb", type: "number", label: "Daily Basic Transfer Volume", required: true, unit: "GB/day", min: 0, step: 1, inputMode: "decimal" },
    { id: "dailyAdvancedTransferVolumeGb", type: "number", label: "Daily Advanced Transfer Volume", required: true, unit: "GB/day", min: 0, step: 1, inputMode: "decimal" },
    { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hour", min: 1, max: 87600, step: 1 },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{rawLogSizeGb} GB/day | {logStorageDurationDays} days | {indexFieldRatio}% | {usageHours}h | {quantity}",
    notes: [
      "This calculator models the visible LTS pay-per-use flow from the Huawei lts calculator and billing documentation.",
      "Read/write traffic uses Huawei's documented 20% compression rule.",
      "When intelligent cold storage is enabled, logs remain in standard storage for seven days before the remaining retention period transitions to cold storage.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "lts",
  serviceCode: "LTS",
  serviceName: "Log Tank Service",
  catalogAdapter: "lts",
  rateSources: {
    flow: {
      catalogKey: "flowTiers[0].ratePerGb",
      description: "LTS read/write traffic rate from the Huawei lts calculator catalog.",
    },
    index: {
      catalogKey: "indexTiers[0].ratePerGb",
      description: "LTS index traffic rate from the Huawei lts calculator catalog.",
    },
    standardStorage: {
      catalogKey: "storageTiers[].ratePerGbHour",
      description: "LTS standard storage rate from the Huawei lts calculator catalog.",
    },
    coldStorage: {
      catalogKey: "storageTiers[].ratePerGbHour",
      description: "LTS cold storage rate from the Huawei lts calculator catalog.",
    },
  },
  metrics: [
    {
      id: "flow",
      label: "Read/write traffic",
      rateSource: "flow",
      quantity: {
        source: "expression",
        expression: "rawLogSizeGb x usageHours",
      },
      unit: "GB",
    },
    {
      id: "index",
      label: "Index traffic",
      rateSource: "index",
      quantity: {
        source: "expression",
        expression: "rawLogSizeGb x indexFieldRatio x usageHours",
      },
      unit: "GB",
    },
    {
      id: "standardStorage",
      label: "Standard storage",
      rateSource: "standardStorage",
      quantity: {
        source: "expression",
        expression: "rawLogSizeGb x logStorageDurationDays x usageHours",
      },
      unit: "GB-hour",
    },
  ],
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  catalogDefinition: {
    source: {
      displayName: "Log Tank Service",
      urlPath: "lts",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "storageTiers",
          path: "product.lts_lts.logstorage",
          fields: [
            {
              key: "storageClass",
              extractor: {
                kind: "keyword-map",
                directPath: "resourceSpecCode",
                directMap: {
                  "lts.log.storage": "Standard",
                  "lts.log.storage.cold": "Cold",
                },
                textPaths: ["resourceSpecCode", "productSpecSysDesc", "log storage", "type"],
                mappings: [
                  { keywords: ["cold"], value: "Cold" },
                  { keywords: ["storage"], value: "Standard" },
                ],
              },
              required: true,
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "ratePerGbHour", extractor: { kind: "plan-amount", billingMode: "ONDEMAND" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          dedupeBy: ["storageClass"],
        },
        {
          targetPath: "indexTiers",
          path: "product.lts_lts.logindex",
          fields: [
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "ratePerGb", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogindex.traffic" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
        },
        {
          targetPath: "flowTiers",
          path: "product.lts_lts.logflow",
          fields: [
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "ratePerGb", extractor: { kind: "plan-amount", billingMode: "ONDEMAND", billingEvent: "event.type.lts.ltslogflow.traffic" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
        },
        {
          targetPath: "transferTiers",
          path: "product.lts_lts.logtransfer",
          fields: [
            {
              key: "transferType",
              extractor: {
                kind: "keyword-map",
                directPath: "resourceSpecCode",
                directMap: {
                  "lts.log.transfer.basic": "Basic",
                  "lts.log.transfer.senior": "Advanced",
                },
                textPaths: ["resourceSpecCode", "productSpecSysDesc", "log transfer"],
                mappings: [
                  { keywords: ["basic"], value: "Basic" },
                  { keywords: ["senior"], value: "Advanced" },
                  { keywords: ["advanced"], value: "Advanced" },
                ],
              },
              required: true,
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "ratePerGb", extractor: { kind: "plan-amount", billingMode: "ONDEMAND" } },
            { key: "productId", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
          ],
          dedupeBy: ["transferType"],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "Workload",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "lts-pricing" },
    showSharedUsageHours: false,
    derived: [
      { key: "rawLogSizeGb", value: call("clampNumber", ref("values.rawLogSizeGb"), 0) },
      { key: "intelligentColdStorage", value: eq(call("boolString", ref("values.intelligentColdStorage")), "true") },
      { key: "logStorageDurationDays", value: call("clampInteger", ref("values.logStorageDurationDays"), 1) },
      { key: "indexFieldRatio", value: call("clampNumber", ref("values.indexFieldRatio"), 0, 100) },
      { key: "dailyBasicTransferVolumeGb", value: call("clampNumber", ref("values.dailyBasicTransferVolumeGb"), 0) },
      { key: "dailyAdvancedTransferVolumeGb", value: call("clampNumber", ref("values.dailyAdvancedTransferVolumeGb"), 0) },
      { key: "usageHours", value: call("clampInteger", ref("values.usageHours"), 1, 87600) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateLtsConfiguration", ref("catalog"), {
            rawLogSizeGb: ref("derived.rawLogSizeGb"),
            intelligentColdStorage: ref("derived.intelligentColdStorage"),
            logStorageDurationDays: ref("derived.logStorageDurationDays"),
            indexFieldRatio: ref("derived.indexFieldRatio"),
            dailyBasicTransferVolumeGb: ref("derived.dailyBasicTransferVolumeGb"),
            dailyAdvancedTransferVolumeGb: ref("derived.dailyAdvancedTransferVolumeGb"),
            usageHours: ref("derived.usageHours"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      rawLogSizeGb: ref("derived.rawLogSizeGb"),
      intelligentColdStorage: ref("derived.intelligentColdStorage"),
      logStorageDurationDays: ref("derived.logStorageDurationDays"),
      indexFieldRatio: ref("derived.indexFieldRatio"),
      dailyBasicTransferVolumeGb: ref("derived.dailyBasicTransferVolumeGb"),
      dailyAdvancedTransferVolumeGb: ref("derived.dailyAdvancedTransferVolumeGb"),
      usageHours: ref("derived.usageHours"),
      quantity: ref("derived.quantity"),
    },
    fieldRuntime: {
      rawLogSizeGb: { min: 0, normalize: ref("derived.rawLogSizeGb") },
      intelligentColdStorage: { normalize: ref("derived.intelligentColdStorage") },
      logStorageDurationDays: { min: 1, normalize: ref("derived.logStorageDurationDays") },
      indexFieldRatio: { min: 0, max: 100, normalize: ref("derived.indexFieldRatio") },
      dailyBasicTransferVolumeGb: { min: 0, normalize: ref("derived.dailyBasicTransferVolumeGb") },
      dailyAdvancedTransferVolumeGb: { min: 0, normalize: ref("derived.dailyAdvancedTransferVolumeGb") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.usageHours") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(
      ref("derived.estimate"),
      null,
      call("firstMeaningfulText", ref("pricingError"), "Log Tank Service pricing is unavailable for the current selection."),
    ),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {raw} GB/day | {retention} days | {index}% index | {hours}h | {quantity} | {estimate}", {
        raw: ref("derived.rawLogSizeGb"),
        retention: ref("derived.logStorageDurationDays"),
        index: ref("derived.indexFieldRatio"),
        hours: ref("derived.usageHours"),
        quantity: template("{quantity} workload{suffix}", {
          quantity: ref("derived.quantity"),
          suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
        }),
        estimate: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
      }),
      "Selected specifications:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call("concatArrays", call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")), ref("derived.estimate.notes")),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud Log Tank Service calculator API for {region}. Sources: {pricingUrl}, {productUrl}, and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.ltsPricingReference.pricingUrl"),
        productUrl: ref("helpers.ltsPricingReference.productUrl"),
        calculatorApi: ref("helpers.ltsPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "lts",
        title: template("{service} {raw} GB/day", {
          service: ref("selectedService"),
          raw: ref("derived.rawLogSizeGb"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: "Pay-per-use",
          rawLogSizeGb: ref("derived.rawLogSizeGb"),
          intelligentColdStorage: ref("derived.intelligentColdStorage"),
          logStorageDurationDays: ref("derived.logStorageDurationDays"),
          indexFieldRatio: ref("derived.indexFieldRatio"),
          dailyBasicTransferVolumeGb: ref("derived.dailyBasicTransferVolumeGb"),
          dailyAdvancedTransferVolumeGb: ref("derived.dailyAdvancedTransferVolumeGb"),
          usageHours: ref("derived.usageHours"),
          quantity: ref("derived.quantity"),
          flowProductId: ref("derived.estimate.flowTier.productId"),
          indexProductId: ref("derived.estimate.indexTier.productId"),
          standardStorageProductId: ref("derived.estimate.standardStorageTier.productId"),
          coldStorageProductId: ref("derived.estimate.coldStorageTier.productId"),
          basicTransferProductId: ref("derived.estimate.basicTransferTier.productId"),
          advancedTransferProductId: ref("derived.estimate.advancedTransferTier.productId"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "lts")),
      {
        handled: true,
        values: {
          rawLogSizeGb: coalesce(ref("product.config.rawLogSizeGb"), ref("helpers.ltsDefaults.rawLogSizeGb")),
          intelligentColdStorage: ref("product.config.intelligentColdStorage"),
          logStorageDurationDays: call("integerString", ref("product.config.logStorageDurationDays"), ref("helpers.ltsDefaults.logStorageDurationDays"), 1),
          indexFieldRatio: coalesce(ref("product.config.indexFieldRatio"), ref("helpers.ltsDefaults.indexFieldRatio")),
          dailyBasicTransferVolumeGb: coalesce(ref("product.config.dailyBasicTransferVolumeGb"), ref("helpers.ltsDefaults.dailyBasicTransferVolumeGb")),
          dailyAdvancedTransferVolumeGb: coalesce(ref("product.config.dailyAdvancedTransferVolumeGb"), ref("helpers.ltsDefaults.dailyAdvancedTransferVolumeGb")),
          usageHours: call("integerString", ref("product.config.usageHours"), ref("helpers.ltsDefaults.usageHours"), 1, 87600),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.ltsDefaults.quantity"), 1),
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

export const pricing = pricingDefinition;
export const service = serviceDefinition;
