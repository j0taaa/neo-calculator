import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "dew",
    serviceCode: "DEW",
    serviceName: "Data Encryption Workshop",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/DEW.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      keyType: "Customer Master Key",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "keyType", type: "select", label: "Key Type", required: true, optionsSource: "catalog.dewKeyTypes" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24 },
    ],
    summary: {
      selectionTemplate: "{keyType} | {quantity} PCS",
      notes: [
        "DEW pricing is based on key type.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "dew",
    serviceCode: "DEW",
    serviceName: "Data Encryption Workshop",
    catalogAdapter: "dew",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "DEW KMS key rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "dewInstance",
        label: "KMS keys",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "DEW",
      urlPath: "dew",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode"], value: "kms" },
      ],
      fields: [
        { key: "label", required: true, extractor: { kind: "keyword-map", textPaths: ["productSpecSysDesc", "resourceSpecCode"], mappings: [
          { keywords: ["user define", "ud.customer"], value: "User-Defined Key" },
          { keywords: ["free"], value: "Free Key" },
          { keywords: ["default"], value: "Default Key" },
          { keywords: ["api", "secret"], value: "API Requests" },
          { keywords: ["hsm", "utimaco", "overseas"], value: "HSM" },
        ] } },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND", usageFactor: "duration" } },
      ],
      dedupeBy: ["label"],
      sort: [
        { path: "label", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Key",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "dew-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "dewKeyTypeOptions",
        value: ifElse(ref("catalog"), call("listDewKeyTypes", ref("catalog")), []),
      },
      { key: "dewKeyType", value: call("resolveOption", ref("values.keyType"), ref("derived.dewKeyTypeOptions"), ref("helpers.dewDefaults.keyType")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "dewUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDewConfiguration", ref("catalog"), {
            keyType: ref("derived.dewKeyType"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.dewUsageHoursValue"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      keyType: ref("derived.dewKeyType"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.dewUsageHoursValue"),
    },
    fieldRuntime: {
      keyType: { options: call("optionList", ref("derived.dewKeyTypeOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.dewUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "DEW pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.dewKeyType"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
          template("{hours}h", { hours: ref("derived.dewUsageHoursValue") }),
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
      "Pricing sourced from Huawei Cloud DEW calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.dewPricingReference.pricingUrl"),
        productUrl: ref("helpers.dewPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "dew",
        title: template("{service} {keyType}", {
          service: ref("selectedService"),
          keyType: ref("derived.dewKeyType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          keyType: ref("derived.dewKeyType"),
          quantity: ref("derived.quantity"),
          usageHours: ref("derived.dewUsageHoursValue"),
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
      and(eq(ref("product.productType"), "dew"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          keyType: coalesce(ref("product.config.keyType"), ref("helpers.dewDefaults.keyType")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.dewDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.dewDefaults.usageHours")),
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
