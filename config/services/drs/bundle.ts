import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "drs",
    serviceCode: "DRS",
    serviceName: "Data Replication Service",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/DRS.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use"],
    defaults: {
      taskType: "Migration",
      direction: "Upstream",
      quantity: 1,
      usageHours: 744,
    },
    fields: [
      { id: "taskType", type: "select", label: "Task Type", required: true, optionsSource: "catalog.drsTaskTypes" },
      { id: "direction", type: "select", label: "Direction", required: true, optionsSource: "catalog.drsDirections" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, minSource: "catalog.constraints.quantity.min", step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, minSource: "catalog.constraints.usageHours.min", maxSource: "catalog.constraints.usageHours.max", step: 24, visibleWhen: { field: "showUsageHours", equals: true } },
    ],
    summary: {
      selectionTemplate: "{taskType} | {direction} | {quantity} task(s)",
      notes: [
        "DRS pricing is based on task type and direction.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "drs",
    serviceCode: "DRS",
    serviceName: "Data Replication Service",
    catalogAdapter: "drs",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "DRS task rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "drsTask",
        label: "DRS tasks",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "DRS",
      urlPath: "drs",
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
        { kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc", "productId"], value: "drs" },
        { kind: "text-excludes", paths: ["resourceSpecCode", "productSpecSysDesc", "productId"], value: "backup" },
      ],
      fields: [
        {
          key: "taskType",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId"],
            mappings: [
              { keywords: ["migration", "migrat", "online-migration"], value: "Migration" },
              { keywords: ["sync", "real-time", "realtime", "synchronization"], value: "Synchronization" },
              { keywords: ["subscription", "subscribe"], value: "Subscription" },
            ],
          },
        },
        {
          key: "direction",
          required: true,
          extractor: {
            kind: "keyword-map",
            textPaths: ["productSpecSysDesc", "resourceSpecCode", "productId"],
            mappings: [
              { keywords: ["upstream", "upload", "to-cloud", "cloud-to-onprem", "reverse"], value: "Upstream" },
              { keywords: ["downstream", "download", "to-onprem", "onprem-to-cloud"], value: "Downstream" },
              { keywords: ["backup"], value: "Backup" },
            ],
          },
        },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND"] } },
        { key: "productIds.ONDEMAND", extractor: { kind: "plan-product-id", billingMode: "ONDEMAND" } },
      ],
      dedupeBy: ["taskType", "direction"],
      sort: [
        { path: "taskType", direction: "asc", order: ["Migration", "Synchronization", "Subscription"] },
        { path: "direction", direction: "asc", order: ["Upstream", "Downstream", "Backup"] },
      ],
    },
  },
  runtime: {
    quantityLabel: "Task",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "drs-pricing" },
    showSharedUsageHours: true,
    derived: [
      {
        key: "drsTaskTypeOptions",
        value: ifElse(ref("catalog"), call("listDrsTaskTypes", ref("catalog")), []),
      },
      { key: "drsTaskType", value: call("resolveOption", ref("values.taskType"), ref("derived.drsTaskTypeOptions"), ref("helpers.drsDefaults.taskType")) },
      {
        key: "drsDirectionOptions",
        value: ifElse(ref("catalog"), call("listDrsDirections", ref("catalog"), ref("derived.drsTaskType")), []),
      },
      { key: "drsDirection", value: call("resolveOption", ref("values.direction"), ref("derived.drsDirectionOptions"), ref("helpers.drsDefaults.direction")) },
      { key: "quantity", value: max(1, call("clampInteger", ref("values.quantity"), 1)) },
      { key: "drsUsageHoursValue", value: max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)) },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateDrsConfiguration", ref("catalog"), {
            taskType: ref("derived.drsTaskType"),
            direction: ref("derived.drsDirection"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.drsUsageHoursValue"),
            billingMode: ref("billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      taskType: ref("derived.drsTaskType"),
      direction: ref("derived.drsDirection"),
      quantity: ref("derived.quantity"),
      usageHours: ref("derived.drsUsageHoursValue"),
    },
    visibilityContext: {
      showUsageHours: eq(ref("billingMode"), "Pay-per-use"),
    },
    fieldRuntime: {
      taskType: { options: call("optionList", ref("derived.drsTaskTypeOptions")) },
      direction: { options: call("optionList", ref("derived.drsDirectionOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.drsUsageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "DRS pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected:",
          ref("derived.drsTaskType"),
          ref("derived.drsDirection"),
          template("{quantity} task{suffix}", { quantity: ref("derived.quantity"), suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s") }),
          ifElse(eq(ref("billingMode"), "Pay-per-use"), template("{hours}h", { hours: ref("derived.drsUsageHoursValue") }), null),
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
      "Pricing sourced from Huawei Cloud DRS calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.drsPricingReference.pricingUrl"),
        productUrl: ref("helpers.drsPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "drs",
        title: template("{service} {taskType} ({direction})", {
          service: ref("selectedService"),
          taskType: ref("derived.drsTaskType"),
          direction: ref("derived.drsDirection"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("billingMode"),
          taskType: ref("derived.drsTaskType"),
          direction: ref("derived.drsDirection"),
          quantity: ref("derived.quantity"),
          usageHours: ifElse(eq(ref("billingMode"), "Pay-per-use"), ref("derived.drsUsageHoursValue"), null),
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
      and(eq(ref("product.productType"), "drs"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          taskType: coalesce(ref("product.config.taskType"), ref("helpers.drsDefaults.taskType")),
          direction: coalesce(ref("product.config.direction"), ref("helpers.drsDefaults.direction")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.drsDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.drsDefaults.usageHours")),
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
