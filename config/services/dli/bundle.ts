import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "dli",
    serviceCode: "DLI",
    serviceName: "Data Lake Insight",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DLI.png",
    implementation: "configurable",
    billingOptions: ["Yearly/Monthly"],
    defaults: {
      billingItem: "Scan",
      specification: "Package",
      quantity: 1,
    },
    fields: [
      { id: "billingItem", type: "select", label: "Billing Item", required: true, optionsSource: "catalog.dliBillingItems" },
      { id: "specification", type: "select", label: "Package / Specification", required: true, optionsSource: "catalog.dliSpecifications" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
    ],
    summary: {
      selectionTemplate: "{billingItem} | {specification} | {quantity} PCS",
      notes: [
        "DLI pricing is based on billing item, package, and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "dli",
    serviceCode: "DLI",
    serviceName: "Data Lake Insight",
    catalogAdapter: "dli",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "DLI instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "dliInstance",
        label: "DLI instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "DLI",
      urlPath: "dli",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc"], value: "dli" },
      ],
      fields: [
        {
          key: "billingItem",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId", "specDesc"],
            mappings: [
              { keywords: ["internaltable", "internal table", "Internal Table"], value: "Internal Table" },
              { keywords: ["scan"], value: "Scan" },
              { keywords: ["elasticresourcepool", "resource pool", "Resource Pool"], value: "Resource Pool" },
            ],
          },
        },
        { key: "specification", required: true, extractor: { kind: "keyword-map", textPaths: ["productSpecSysDesc", "resourceSpecCode"], mappings: [
          { keywords: ["16cud", "16cu"], value: "16CU" },
          { keywords: ["32cud", "32cu"], value: "32CU" },
          { keywords: ["64cud", "64cu"], value: "64CU" },
          { keywords: ["128cud", "128cu"], value: "128CU" },
          { keywords: ["package"], value: "Package" },
          { keywords: ["table"], value: "Table" },
        ] } },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["MONTHLY", "YEARLY"] } },
        { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
        { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
      ],
      dedupeBy: ["billingItem", "specification"],
      sort: [
        { path: "billingItem", direction: "asc", order: ["Internal Table", "Scan", "Resource Pool"] },
        { path: "specification", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "dli-pricing" },
    showSharedUsageHours: false,
    derived: [
      {
        key: "dliBillingItemOptions",
        value: ifElse(ref("catalog"), call("listDliBillingItems", ref("catalog")), []),
      },
      { key: "dliBillingItem", value: call("resolveOption", ref("values.billingItem"), ref("derived.dliBillingItemOptions"), ref("helpers.dliDefaults.billingItem")) },
      {
        key: "dliSpecificationOptions",
        value: ifElse(ref("catalog"), call("listDliSpecifications", ref("catalog"), ref("derived.dliBillingItem")), []),
      },
      { key: "dliSpecification", value: call("resolveOption", ref("values.specification"), ref("derived.dliSpecificationOptions"), ref("helpers.dliDefaults.specification")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDliConfiguration", ref("catalog"), {
            billingItem: ref("derived.dliBillingItem"),
            specification: ref("derived.dliSpecification"),
            quantity: ref("derived.quantity"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      billingItem: ref("derived.dliBillingItem"),
      specification: ref("derived.dliSpecification"),
      quantity: ref("derived.quantity"),
    },
    visibilityContext: {},
    fieldRuntime: {
      billingItem: { options: call("optionList", ref("derived.dliBillingItemOptions")) },
      specification: { options: call("optionList", ref("derived.dliSpecificationOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "DLI pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.dliBillingItem"),
          ref("derived.dliSpecification"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
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
      "Pricing sourced from Huawei Cloud DLI calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.dliPricingReference.pricingUrl"),
        productUrl: ref("helpers.dliPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "dli",
        title: template("{service} {billingItem} {spec}", {
          service: ref("selectedService"),
          billingItem: ref("derived.dliBillingItem"),
          spec: ref("derived.dliSpecification"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          billingItem: ref("derived.dliBillingItem"),
          specification: ref("derived.dliSpecification"),
          quantity: ref("derived.quantity"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: ref("derived.estimate.tier.productId"),
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
      and(eq(ref("product.productType"), "dli"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          billingItem: coalesce(ref("product.config.billingItem"), ref("helpers.dliDefaults.billingItem")),
          specification: coalesce(ref("product.config.specification"), ref("helpers.dliDefaults.specification")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.dliDefaults.quantity")),
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
};

export const serviceDefinition = configurableServiceBundle.service;
export const pricingDefinition = configurableServiceBundle.pricing;
