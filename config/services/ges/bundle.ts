import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "ges",
    serviceCode: "GES",
    serviceName: "Graph Engine Service",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/AI/ges.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      graphSize: "10 thousand edges",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "graphSize", type: "select", label: "Billing Item", required: true, optionsSource: "catalog.graphSizes" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, minSource: "catalog.constraints.quantity.min", step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, minSource: "catalog.constraints.usageHours.min", maxSource: "catalog.constraints.usageHours.max", step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{graphSize} | {quantity} PCS",
      notes: [
        "GES pricing is based on graph size (number of edges) and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "ges",
    serviceCode: "GES",
    serviceName: "Graph Engine Service",
    catalogAdapter: "ges",
    rateSources: {
      graph: {
        catalogKey: "tiers.prices",
        description: "GES graph instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "graphInstance",
        label: "Graph instances",
        rateSource: "graph",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "GES",
      urlPath: "ges",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      catalogStatic: {
        constraints: {
          graphSize: { min: 1 },
          quantity: { min: 1 },
          usageHours: { min: 1, max: 87600 },
        },
      },
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc"], value: "graph" },
        { kind: "field-not-equals", path: "billingEvent", value: "event.type.ges.duration" },
      ],
      fields: [
        { key: "graphSize", required: true, extractor: { kind: "path-or-template", path: "specDesc" } },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND", usageFactor: "count" } },
        { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
        { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
      ],
      dedupeBy: ["graphSize"],
      minByPath: "prices.ONDEMAND",
      sort: [
        { path: "graphSize", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "ges-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "graphSizeOptions",
        value: ifElse(ref("catalog"), call("listGesGraphSizes", ref("catalog")), []),
      },
      { key: "graphSize", value: call("resolveOption", ref("values.graphSize"), ref("derived.graphSizeOptions"), ref("helpers.gesDefaults.graphSize")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "gesUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateGesConfiguration", ref("catalog"), {
            graphSize: ref("derived.graphSize"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.gesUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      graphSize: ref("derived.graphSize"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.gesUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      graphSize: { options: call("optionList", ref("derived.graphSizeOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.gesUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "GES pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.graphSize"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.gesUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud GES calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.gesPricingReference.pricingUrl"),
        productUrl: ref("helpers.gesPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "ges",
        title: template("{service} {graphSize}", {
          service: ref("selectedService"),
          graphSize: ref("derived.graphSize"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          graphSize: ref("derived.graphSize"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.gesUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "ges"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          graphSize: coalesce(ref("product.config.graphSize"), ref("helpers.gesDefaults.graphSize")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.gesDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.gesDefaults.usageHours")),
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
