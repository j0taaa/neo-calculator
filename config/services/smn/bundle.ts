import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "smn",
    serviceCode: "SMN",
    serviceName: "Simple Message Notification",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/ManagementGovernance/SMN.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      protocolType: "HTTP/HTTPS",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "protocolType", type: "select", label: "Protocol Type", required: true, optionsSource: "catalog.smnProtocolTypes" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24 },
    ],
    summary: {
      selectionTemplate: "{protocolType} | {quantity} PCS",
      notes: [
        "SMN pricing is based on protocol type.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "smn",
    serviceCode: "SMN",
    serviceName: "Simple Message Notification",
    catalogAdapter: "smn",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "SMN notification rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "smnInstance",
        label: "SMN instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "SMN",
      urlPath: "smn",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode"], value: "smn" },
      ],
      fields: [
        { key: "label", required: true, extractor: { kind: "keyword-map", textPaths: ["productSpecSysDesc", "resourceSpecCode"], mappings: [
          { keywords: ["http", "https"], value: "HTTP/HTTPS" },
          { keywords: ["sms"], value: "SMS" },
          { keywords: ["email"], value: "Email" },
          { keywords: ["application"], value: "Application" },
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
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "smn-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "smnProtocolTypeOptions",
        value: ifElse(ref("catalog"), call("listSmnProtocolTypes", ref("catalog")), []),
      },
      { key: "smnProtocolType", value: call("resolveOption", ref("values.protocolType"), ref("derived.smnProtocolTypeOptions"), ref("helpers.smnDefaults.protocolType")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "smnUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateSmnConfiguration", ref("catalog"), {
            protocolType: ref("derived.smnProtocolType"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.smnUsageHoursValue"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      protocolType: ref("derived.smnProtocolType"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.smnUsageHoursValue"),
    },
    fieldRuntime: {
      protocolType: { options: call("optionList", ref("derived.smnProtocolTypeOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.smnUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "SMN pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.smnProtocolType"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
          template("{hours}h", { hours: ref("derived.smnUsageHoursValue") }),
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
      "Pricing sourced from Huawei Cloud SMN calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.smnPricingReference.pricingUrl"),
        productUrl: ref("helpers.smnPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "smn",
        title: template("{service} {protocolType}", {
          service: ref("selectedService"),
          protocolType: ref("derived.smnProtocolType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          protocolType: ref("derived.smnProtocolType"),
          quantity: ref("derived.quantity"),
          usageHours: ref("derived.smnUsageHoursValue"),
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
      and(eq(ref("product.productType"), "smn"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          protocolType: coalesce(ref("product.config.protocolType"), ref("helpers.smnDefaults.protocolType")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.smnDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.smnDefaults.usageHours")),
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
