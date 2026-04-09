import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "cse",
    serviceCode: "CSE",
    serviceName: "Cloud Service Engine",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Middleware/CSE.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      specification: "cse.s1.small",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "specification", type: "select", label: "Specification", required: true, optionsSource: "catalog.cseSpecifications" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{specification} | {quantity} PCS",
      notes: [
        "CSE pricing is based on specification and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "cse",
    serviceCode: "CSE",
    serviceName: "Cloud Service Engine",
    catalogAdapter: "cse",
    rateSources: {
      engine: {
        catalogKey: "tiers.prices",
        description: "CSE engine instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "cseInstance",
        label: "CSE instances",
        rateSource: "engine",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "CSE",
      urlPath: "cse",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode"], value: "cse" },
        { kind: "text-excludes", paths: ["resourceSpecCode"], value: "servicestage" },
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
      minByPath: "prices.ONDEMAND",
      sort: [
        { path: "specification", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "cse-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "cseSpecificationOptions",
        value: ifElse(ref("catalog"), call("listCseSpecifications", ref("catalog")), []),
      },
      { key: "specification", value: call("resolveOption", ref("values.specification"), ref("derived.cseSpecificationOptions"), ref("helpers.cseDefaults.specification")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "cseUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateCseConfiguration", ref("catalog"), {
            specification: ref("derived.specification"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.cseUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      specification: ref("derived.specification"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.cseUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      specification: { options: call("optionList", ref("derived.cseSpecificationOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.cseUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "CSE pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.specification"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.cseUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud CSE calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.csePricingReference.pricingUrl"),
        productUrl: ref("helpers.csePricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "cse",
        title: template("{service} {specification}", {
          service: ref("selectedService"),
          specification: ref("derived.specification"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          specification: ref("derived.specification"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.cseUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "cse"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          specification: coalesce(ref("product.config.specification"), ref("helpers.cseDefaults.specification")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.cseDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.cseDefaults.usageHours")),
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
