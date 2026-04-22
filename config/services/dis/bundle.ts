import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "dis",
    serviceCode: "DIS",
    serviceName: "Data Ingestion Service",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Analytics/DIS.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      type: "General",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "type", type: "select", label: "Type", required: true, optionsSource: "catalog.disTypes" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, minSource: "catalog.constraints.quantity.min", step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, minSource: "catalog.constraints.usageHours.min", maxSource: "catalog.constraints.usageHours.max", step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{type} | {quantity} PCS",
      notes: [
        "DIS pricing is based on type and billing mode.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "dis",
    serviceCode: "DIS",
    serviceName: "Data Ingestion Service",
    catalogAdapter: "dis",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "DIS instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "disInstance",
        label: "DIS instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "DIS",
      urlPath: "dis",
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
        { kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc"], value: "dis" },
      ],
      fields: [
        {
          key: "type",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId", "specDesc"],
            mappings: [
              { keywords: ["general"], value: "General" },
              { keywords: ["advanced"], value: "Advanced" },
            ],
          },
        },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        {
          key: "usageFactor",
          extractor: {
            kind: "keyword-map",
            directPath: "usageFactor",
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId"],
            mappings: [
              { keywords: ["inputunitnum", "input_unit", "input unit"], value: "inputunitnum" },
              { keywords: ["duration"], value: "duration" },
              { keywords: ["datastore", "data_store"], value: "datastore" },
            ],
          },
        },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND", usageFactor: "inputunitnum" } },
      ],
      dedupeBy: ["type", "usageFactor"],
      sort: [
        { path: "type", direction: "asc", order: ["General", "Advanced"] },
        { path: "usageFactor", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "dis-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "disTypeOptions",
        value: ifElse(ref("catalog"), call("listDisTypes", ref("catalog")), []),
      },
      { key: "disType", value: call("resolveOption", ref("values.type"), ref("derived.disTypeOptions"), ref("helpers.disDefaults.type")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "disUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDisConfiguration", ref("catalog"), {
            type: ref("derived.disType"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.disUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      type: ref("derived.disType"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.disUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      type: { options: call("optionList", ref("derived.disTypeOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.disUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "DIS pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.disType"),
          template("{quantity} PCS", { quantity: ref("derived.quantity") }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.disUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud DIS calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.disPricingReference.pricingUrl"),
        productUrl: ref("helpers.disPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "dis",
        title: template("{service} {type}", {
          service: ref("selectedService"),
          type: ref("derived.disType"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          type: ref("derived.disType"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.disUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "dis"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          type: coalesce(ref("product.config.type"), ref("helpers.disDefaults.type")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.disDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.disDefaults.usageHours")),
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
