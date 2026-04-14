import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "mrs",
    serviceCode: "MRS",
    serviceName: "MapReduce Service",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DWS.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      clusterType: "Analysis",
      nodeType: "Master",
      quantity: 2,
      usageHours: 744,
    },
    fields: [
      { id: "clusterType", type: "select", label: "Cluster Type", required: true, optionsSource: "catalog.mrsClusterTypes" },
      { id: "nodeType", type: "select", label: "Node Type", required: true, optionsSource: "catalog.mrsNodeTypes" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{clusterType} | {nodeType} | {quantity} node(s)",
      notes: [
        "MRS pricing is based on cluster type, node type, and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "mrs",
    serviceCode: "MRS",
    serviceName: "MapReduce Service",
    catalogAdapter: "mrs",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "MRS node rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "mrsNode",
        label: "MRS nodes",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "MRS",
      urlPath: "mrs",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc", "productId"], value: "mrs" },
      ],
      fields: [
        {
          key: "clusterType",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId"],
            mappings: [
              { keywords: ["analysis", "analys", "data-analysis", "data_analysis"], value: "Analysis" },
              { keywords: ["streaming", "stream", "real-time", "realtime", "flink", "storm"], value: "Streaming" },
            ],
          },
        },
        {
          key: "nodeType",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId"],
            mappings: [
              { keywords: ["master", "manager", "control"], value: "Master" },
              { keywords: ["core", "data", "worker"], value: "Core" },
              { keywords: ["task", "compute"], value: "Task" },
            ],
          },
        },
        {
          key: "label",
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode"],
            mappings: [
              { keywords: ["small"], value: "Small" },
              { keywords: ["medium", "mid"], value: "Medium" },
              { keywords: ["large", "big"], value: "Large" },
              { keywords: ["xlarge", "extra"], value: "XLarge" },
            ],
          },
        },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
      ],
      dedupeBy: ["clusterType", "nodeType", "label"],
      sort: [
        { path: "clusterType", direction: "asc", order: ["Analysis", "Streaming"] },
        { path: "nodeType", direction: "asc", order: ["Master", "Core", "Task"] },
        { path: "label", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Node",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "mrs-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "mrsClusterTypeOptions",
        value: ifElse(ref("catalog"), call("listMrsClusterTypes", ref("catalog")), []),
      },
      { key: "mrsClusterType", value: call("resolveOption", ref("values.clusterType"), ref("derived.mrsClusterTypeOptions"), ref("helpers.mrsDefaults.clusterType")) },
      {
        key: "mrsNodeTypeOptions",
        value: ifElse(ref("catalog"), call("listMrsNodeTypes", ref("catalog"), ref("derived.mrsClusterType")), []),
      },
      { key: "mrsNodeType", value: call("resolveOption", ref("values.nodeType"), ref("derived.mrsNodeTypeOptions"), ref("helpers.mrsDefaults.nodeType")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "mrsUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateMrsConfiguration", ref("catalog"), {
            clusterType: ref("derived.mrsClusterType"),
            nodeType: ref("derived.mrsNodeType"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.mrsUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      clusterType: ref("derived.mrsClusterType"),
      nodeType: ref("derived.mrsNodeType"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.mrsUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      clusterType: { options: call("optionList", ref("derived.mrsClusterTypeOptions")) },
      nodeType: { options: call("optionList", ref("derived.mrsNodeTypeOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.mrsUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "MRS pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.mrsClusterType"),
          ref("derived.mrsNodeType"),
          template("{quantity} node{suffix}", { quantity: ref("derived.quantity"), suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s") }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.mrsUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud MRS calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.mrsPricingReference.pricingUrl"),
        productUrl: ref("helpers.mrsPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "mrs",
        title: template("{service} {clusterType} {nodeType}", {
          service: ref("selectedService"),
          clusterType: ref("derived.mrsClusterType"),
          nodeType: ref("derived.mrsNodeType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          clusterType: ref("derived.mrsClusterType"),
          nodeType: ref("derived.mrsNodeType"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.mrsUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "mrs"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          clusterType: coalesce(ref("product.config.clusterType"), ref("helpers.mrsDefaults.clusterType")),
          nodeType: coalesce(ref("product.config.nodeType"), ref("helpers.mrsDefaults.nodeType")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.mrsDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.mrsDefaults.usageHours")),
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
