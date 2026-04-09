import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "dws",
    serviceCode: "DWS",
    serviceName: "Data Warehouse Service",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DWS.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      specification: "dwsx.8xlarge",
      storageType: "Ultra-high I/O",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "specification", type: "select", label: "Specification", required: true, optionsSource: "catalog.dwsSpecifications" },
      { id: "storageType", type: "select", label: "Storage Type", required: true, options: ["Ultra-high I/O", "High I/O", "Common I/O"] },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{specification} | {storageType} | {quantity} PCS",
      notes: [
        "DWS pricing is based on node specification, storage type, and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "dws",
    serviceCode: "DWS",
    serviceName: "Data Warehouse Service",
    catalogAdapter: "dws",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "DWS instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "dwsInstance",
        label: "DWS instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "DWS",
      urlPath: "dws",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode"], value: "dws" },
        { kind: "text-excludes", paths: ["resourceSpecCode"], value: "volume" },
      ],
      fields: [
        { key: "specification", required: true, extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND", usageFactor: "duration" } },
        { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
        { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
      ],
      dedupeBy: ["specification"],
      sort: [
        { path: "specification", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "dws-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "dwsSpecificationOptions",
        value: ifElse(ref("catalog"), call("listDwsSpecifications", ref("catalog"), ref("billingMode")), []),
      },
      { key: "dwsSpecification", value: call("resolveOption", ref("values.specification"), ref("derived.dwsSpecificationOptions"), ref("helpers.dwsDefaults.specification")) },
      { key: "dwsStorageType", value: call("resolveOption", ref("values.storageType"), ["Ultra-high I/O", "High I/O", "Common I/O"], ref("helpers.dwsDefaults.storageType")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "dwsUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDwsConfiguration", ref("catalog"), {
            specification: ref("derived.dwsSpecification"),
            storageType: ref("derived.dwsStorageType"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.dwsUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      specification: ref("derived.dwsSpecification"),
      storageType: ref("derived.dwsStorageType"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.dwsUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      specification: { options: call("optionList", ref("derived.dwsSpecificationOptions")) },
      storageType: { normalize: ref("derived.dwsStorageType") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.dwsUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "DWS pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.dwsSpecification"),
          ref("derived.dwsStorageType"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.dwsUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud DWS calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.dwsPricingReference.pricingUrl"),
        productUrl: ref("helpers.dwsPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "dws",
        title: template("{service} {spec} ({storage})", {
          service: ref("selectedService"),
          spec: ref("derived.dwsSpecification"),
          storage: ref("derived.dwsStorageType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          specification: ref("derived.dwsSpecification"),
          storageType: ref("derived.dwsStorageType"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.dwsUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "dws"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          specification: coalesce(ref("product.config.specification"), ref("helpers.dwsDefaults.specification")),
          storageType: coalesce(ref("product.config.storageType"), ref("helpers.dwsDefaults.storageType")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.dwsDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.dwsDefaults.usageHours")),
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
