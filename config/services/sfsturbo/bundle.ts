import type { ConfigurableServiceBundleDefinition } from "@/lib/configurable-service-bundle-types";
import type { PricingDefinition, ServiceDefinition } from "@/lib/service-config-types";
import { and, call, coalesce, eq, ifElse, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const serviceDefinition = {
  version: 1,
  definitionId: "sfsturbo",
  serviceCode: "SFS Turbo",
  serviceName: "Scalable File Service Turbo",
  icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Storage/SFS.png",
  implementation: "configurable",
  billingOptions: ["Yearly/Monthly", "Pay-per-use"],
  defaults: {
    fileSystemType: "SFS Turbo",
    generation: "On Sale",
    type: "20MB/s/TiB",
    capacityTb: 2,
    durationMonths: 1,
    quantity: 1,
  },
  fields: [
    { id: "fileSystemType", type: "select", label: "File System Type", required: true, options: ["SFS Turbo"] },
    { id: "generation", type: "select", label: "Series", required: true, optionsSource: "catalog.generationOptions" },
    { id: "type", type: "select", label: "Type", required: true, optionsSource: "catalog.typeOptions" },
    { id: "capacityTb", type: "select", label: "Capacity (TB)", required: true, optionsSource: "catalog.capacityOptions" },
    { id: "durationMonths", type: "select", label: "Required Duration", required: true, optionsSource: "catalog.durationMonthOptions", visibleWhen: { field: "billingMode", equals: "Yearly/Monthly" } },
    { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
  ],
  summary: {
    selectionTemplate: "{fileSystemType} | {generation} | {type} | {capacityTb} TB | {quantity}",
    notes: [
      "This calculator models the Huawei sfsturbo calculator flow using the on-sale and previous-generation file system rates exposed by the live catalog.",
      "Capacity options follow the Huawei calculator buttons: 2, 4, 8, 16, 24, 32, and 48 TB.",
    ],
  },
} satisfies ServiceDefinition;

export const pricingDefinition = {
  version: 1,
  definitionId: "sfsturbo",
  serviceCode: "SFS Turbo",
  serviceName: "Scalable File Service Turbo",
  catalogAdapter: "sfsturbo",
  rateSources: {
    tier: {
      catalogKey: "tiers.plans",
      description: "Normalized Scalable File Service Turbo rates from the Huawei sfsturbo calculator catalog.",
    },
  },
  metrics: [
    {
      id: "capacity",
      label: "Capacity",
      rateSource: "tier",
      quantity: {
        source: "field",
        field: "capacityTb",
      },
      unit: "TB",
    },
  ],
} satisfies PricingDefinition;

export const configurableServiceBundle = {
  service: serviceDefinition,
  pricing: pricingDefinition,
  catalogDefinition: {
    source: {
      displayName: "Scalable File Service Turbo",
      urlPath: "sfsturbo",
      tab: "calc",
    },
    parser: {
      kind: "grouped-sections",
      currency: "USD",
      sections: [
        {
          targetPath: "tiers",
          path: "product.sfsturbo_sfsturbo",
          fields: [
            {
              key: "generation",
              extractor: {
                kind: "conditional",
                when: [{ kind: "field-matches-regex", path: "resourceSpecCode", pattern: "MBps" }],
                then: { kind: "literal", value: "On Sale" },
                else: { kind: "literal", value: "Previous-Generation File Systems" },
              },
              required: true,
            },
            { key: "fileSystemType", extractor: { kind: "literal", value: "SFS Turbo" }, required: true },
            {
              key: "type",
              extractor: {
                kind: "keyword-map",
                directPath: "type",
                directMap: {
                  "20MBps": "20MB/s/TiB",
                  "40MBps": "40MB/s/TiB",
                  "125MBps": "125MB/s/TiB",
                  "250MBps": "250MB/s/TiB",
                  "500MBps": "500MB/s/TiB",
                  "1000MBps": "1000MB/s/TiB",
                  standard: "Standard",
                  performance: "Performance",
                  "standard dec": "Standard Dedicated",
                  "performance dec": "Performance Dedicated",
                },
                textPaths: ["type", "resourceSpecCode", "productSpecSysDesc"],
                mappings: [],
              },
              required: true,
            },
            { key: "resourceSpecCode", extractor: { kind: "path", path: "resourceSpecCode" } },
            { key: "plans", extractor: { kind: "path", path: "planList" } },
          ],
          dedupeBy: ["generation", "type"],
          sort: [
            { path: "generation", direction: "asc", order: ["On Sale", "Previous-Generation File Systems"] },
            { path: "type", direction: "asc", order: ["20MB/s/TiB", "40MB/s/TiB", "125MB/s/TiB", "250MB/s/TiB", "500MB/s/TiB", "1000MB/s/TiB", "Standard", "Performance", "Standard Dedicated", "Performance Dedicated"] },
          ],
        },
      ],
    },
  },
  runtime: {
    quantityLabel: "File System",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "sfsturbo-pricing" },
    showSharedUsageHours: true,
    derived: [
      { key: "fileSystemTypeOptions", value: ["SFS Turbo"] },
      { key: "fileSystemType", value: call("resolveOption", ref("values.fileSystemType"), ref("derived.fileSystemTypeOptions"), ref("helpers.sfsTurboDefaults.fileSystemType")) },
      { key: "generationOptions", value: ifElse(ref("catalog"), call("listSfsTurboGenerations", ref("catalog")), []) },
      { key: "generation", value: call("resolveOption", ref("values.generation"), ref("derived.generationOptions"), ref("helpers.sfsTurboDefaults.generation")) },
      { key: "typeOptions", value: ifElse(ref("catalog"), call("listSfsTurboTypes", ref("catalog"), ref("derived.generation")), []) },
      { key: "type", value: call("resolveOption", ref("values.type"), ref("derived.typeOptions"), ref("helpers.sfsTurboDefaults.type")) },
      { key: "capacityOptions", value: call("listSfsTurboCapacityOptions") },
      { key: "capacityTb", value: call("resolveNumberOption", ref("values.capacityTb"), ref("derived.capacityOptions"), ref("helpers.sfsTurboDefaults.capacityTb")) },
      { key: "durationMonthOptions", value: ifElse(ref("catalog"), call("listSfsTurboDurationMonths", ref("catalog"), { generation: ref("derived.generation"), type: ref("derived.type") }), []) },
      { key: "durationMonths", value: call("resolveNumberOption", ref("values.durationMonths"), ref("derived.durationMonthOptions"), ref("helpers.sfsTurboDefaults.durationMonths")) },
      { key: "quantity", value: call("clampInteger", ref("values.quantity"), 1) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateSfsTurboConfiguration", ref("catalog"), {
            billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
            generation: ref("derived.generation"),
            type: ref("derived.type"),
            capacityTb: ref("derived.capacityTb"),
            durationMonths: ref("derived.durationMonths"),
            usageHours: ref("usageHoursValue"),
            quantity: ref("derived.quantity"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      fileSystemType: ref("derived.fileSystemType"),
      generation: ref("derived.generation"),
      type: ref("derived.type"),
      capacityTb: ref("derived.capacityTb"),
      durationMonths: ref("derived.durationMonths"),
      quantity: ref("derived.quantity"),
    },
    activeBillingOptions: ifElse(
      ref("catalog"),
      call("listSfsTurboBillingOptions", ref("catalog"), { generation: ref("derived.generation"), type: ref("derived.type") }),
      ["Yearly/Monthly", "Pay-per-use"],
    ),
    fieldRuntime: {
      fileSystemType: { options: call("optionList", ref("derived.fileSystemTypeOptions")) },
      generation: { options: call("optionList", ref("derived.generationOptions")) },
      type: { options: call("optionList", ref("derived.typeOptions")) },
      capacityTb: { options: call("optionList", ref("derived.capacityOptions")) },
      durationMonths: { options: call("optionList", ref("derived.durationMonthOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "Scalable File Service Turbo pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      template("Selected specifications: {generation} | {type} | {capacity} | {term} | {quantity} | {estimate}", {
        generation: ref("derived.generation"),
        type: ref("derived.type"),
        capacity: template("{capacityTb} TB", { capacityTb: ref("derived.capacityTb") }),
        term: ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("usageHoursValue") }), template("{months}mo", { months: ref("derived.durationMonths") })),
        quantity: template("{quantity} file system{suffix}", {
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
      "Pricing sourced from Huawei Scalable File Service Turbo calculator API for {region}. Sources: {pricingUrl} and {calculatorApi}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.sfsTurboPricingReference.pricingUrl"),
        calculatorApi: ref("helpers.sfsTurboPricingReference.calculatorApi"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "sfsturbo",
        title: template("{service} {type}", {
          service: ref("selectedService"),
          type: ref("derived.type"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ifElse(eq(ref("billingMode"), "Pay-per-use"), "Pay-per-use", "Yearly/Monthly"),
          fileSystemType: ref("derived.fileSystemType"),
          generation: ref("derived.generation"),
          type: ref("derived.type"),
          capacityTb: ref("derived.capacityTb"),
          capacityGb: call("multiplyNumbers", ref("derived.capacityTb"), 1024),
          durationMonths: ifElse(eq(ref("billingMode"), "Yearly/Monthly"), ref("derived.durationMonths"), null),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("usageHoursValue"), null),
          quantity: ref("derived.quantity"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.selectedPlan.productId"),
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
      and(call("isRecord", ref("product.config")), eq(ref("product.productType"), "sfsturbo")),
      {
        handled: true,
        values: {
          fileSystemType: coalesce(ref("product.config.fileSystemType"), ref("helpers.sfsTurboDefaults.fileSystemType")),
          generation: coalesce(ref("product.config.generation"), ref("helpers.sfsTurboDefaults.generation")),
          type: coalesce(ref("product.config.type"), ref("helpers.sfsTurboDefaults.type")),
          capacityTb: call("integerString", ref("product.config.capacityTb"), ref("helpers.sfsTurboDefaults.capacityTb"), 2),
          durationMonths: call("integerString", ref("product.config.durationMonths"), ref("helpers.sfsTurboDefaults.durationMonths"), 1, 36),
          quantity: call("integerString", ref("product.config.quantity"), ref("helpers.sfsTurboDefaults.quantity"), 1),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
        nextBillingMode: coalesce(ref("product.config.billingMode"), "Yearly/Monthly"),
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
