import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "hss",
    serviceCode: "HSS",
    serviceName: "Host Security Service",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/SecurityCompliance/CFW.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      edition: "hss.version.type:Advanced",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "edition", type: "select", label: "Edition", required: true, optionsSource: "catalog.hssEditions" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, minSource: "catalog.constraints.quantity.min", step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, minSource: "catalog.constraints.usageHours.min", maxSource: "catalog.constraints.usageHours.max", step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{edition} | {quantity} PCS",
      notes: [
        "HSS pricing is based on edition and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "hss",
    serviceCode: "HSS",
    serviceName: "Host Security Service",
    catalogAdapter: "hss",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "HSS instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "hssInstance",
        label: "HSS instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "HSS",
      urlPath: "hss",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      catalogStatic: {
        constraints: {
          quantity: { min: 1 },
          usageHours: { min: 1, max: 87600 },
        },
      },
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode"], value: "hss" },
        { kind: "text-includes", paths: ["resourceSpecCode"], value: "version" },
      ],
      fields: [
        { key: "edition", required: true, extractor: { kind: "path-or-template", path: "productSpecSysDesc", template: "{productSpecSysDesc}" } },
        { key: "editionLabel", extractor: { kind: "keyword-map", textPaths: ["productSpecSysDesc", "specDesc", "resourceSpecCode"], mappings: [
          { keywords: ["web tamper", "wtp"], value: "Web Tamper Protection" },
          { keywords: ["premium"], value: "Premium" },
          { keywords: ["advanced"], value: "Advanced" },
          { keywords: ["container guard"], value: "Container Guard Enterprise" },
          { keywords: ["basic"], value: "Basic" },
        ] } },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND", usageFactor: "duration" } },
        { key: "productIds.MONTHLY", extractor: { kind: "plan-product-id", billingMode: "MONTHLY" } },
        { key: "productIds.YEARLY", extractor: { kind: "plan-product-id", billingMode: "YEARLY" } },
      ],
      dedupeBy: ["edition"],
      sort: [
        { path: "edition", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "hss-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "hssEditionOptions",
        value: ifElse(ref("catalog"), call("listHssEditions", ref("catalog"), ref("billingMode")), []),
      },
      { key: "hssEdition", value: coalesce(ref("values.edition"), ref("helpers.hssDefaults.edition")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "hssUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateHssConfiguration", ref("catalog"), {
            edition: ref("derived.hssEdition"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.hssUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      edition: ref("derived.hssEdition"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.hssUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      edition: { options: ref("derived.hssEditionOptions") },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.hssUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "HSS pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.hssEdition"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.hssUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud HSS calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.hssPricingReference.pricingUrl"),
        productUrl: ref("helpers.hssPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "hss",
        title: template("{service} {edition}", {
          service: ref("selectedService"),
          edition: ref("derived.hssEdition"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          edition: ref("derived.hssEdition"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.hssUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "hss"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          edition: coalesce(ref("product.config.edition"), ref("helpers.hssDefaults.edition")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.hssDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.hssDefaults.usageHours")),
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
