import { and, call, coalesce, eq, ifElse, max, ref, template } from "@/lib/typed-declarative-runtime-ops";

export const configurableServiceBundle = {
  service: {
    version: 1,
    definitionId: "gaussdb",
    serviceCode: "GaussDB",
    serviceName: "GaussDB",
    icon: "https://res-static.hc-cdn.cn/cloudbu-site/public/product-banner-icon/Databases/GaussDB.png",
    implementation: "configurable",
    billingOptions: ["Pay-per-use", "Yearly/Monthly"],
    defaults: {
      dbEdition: "Basic Edition",
      specification: "2 vCPUs, 4 GB",
      quantity: 1,
      usageHours: 744,
      billingMode: "Pay-per-use",
    },
    fields: [
      { id: "dbEdition", type: "select", label: "DB Edition", required: true, optionsSource: "catalog.editionOptions" },
      { id: "specification", type: "select", label: "Specification", required: true, optionsSource: "catalog.specificationOptions" },
      { id: "quantity", type: "number", label: "Quantity", required: true, min: 1, step: 1 },
      { id: "usageHours", type: "number", label: "Required Duration", required: true, unit: "hours", min: 1, max: 87600, step: 24 },
    ],
    summary: {
      selectionTemplate: "{dbEdition} | {specification}",
      notes: [
        "This calculator models GaussDB pay-per-use and yearly/monthly billing.",
      ],
    },
  },
  pricing: {
    version: 1,
    definitionId: "gaussdb",
    serviceCode: "GaussDB",
    serviceName: "GaussDB",
    catalogAdapter: "gaussdb",
    rateSources: {
      instance: {
        catalogKey: "tiers.prices",
        description: "Normalized GaussDB instance rates from the productInfo catalog.",
      },
    },
    metrics: [
      {
        id: "gaussdbInstance",
        label: "GaussDB instances",
        rateSource: "instance",
        quantity: { source: "field", field: "quantity" },
      },
    ],
  },
  catalogDefinition: {
    source: {
      displayName: "GaussDB",
      urlPath: "gaussdb",
      tab: "calc",
    },
    parser: {
      kind: "recursive-grouped-records",
      currency: "USD",
      rootPath: "product",
      collectionKey: "tiers",
      catalogStatic: {},
      recordFilters: [
        { kind: "text-includes", paths: ["resourceSpecCode", "productSpecSysDesc"], value: "gaussdb" },
        { kind: "field-equals", path: "cloudServiceType", value: "hws.service.type.gaussdb" },
      ],
      fields: [
        {
          key: "dbEdition",
          required: true,
          extractor: {
            kind: "keyword-map",
            directPath: "specType",
            directMap: {
              GaussDB_Basic_Edition: "Basic Edition",
            },
            textPaths: ["productSpecSysDesc", "resourceSpecCode"],
            mappings: [
              { keywords: ["basic"], value: "Basic Edition" },
              { keywords: ["advanced"], value: "Advanced Edition" },
              { keywords: ["enterprise"], value: "Advanced Edition" },
            ],
          },
        },
        { key: "vCpus", required: true, extractor: { kind: "cpu-count", paths: ["cpu", "vcpu", "vcpus", "productSpecSysDesc", "resourceSpecCode"] } },
        { key: "memoryGb", required: true, extractor: { kind: "memory-gib", paths: ["mem", "memory", "productSpecSysDesc", "resourceSpecCode"] } },
        { key: "specification", required: true, extractor: { kind: "path-or-template", path: "specification", template: "{vCpus} vCPUs, {memoryGb} GB" } },
        { key: "resourceSpecCode", extractor: { kind: "path-or-template", path: "resourceSpecCode", template: "gaussdb-{dbEdition}-{vCpus}-{memoryGb}" } },
        { key: "prices", extractor: { kind: "rate-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
        { key: "productIds", extractor: { kind: "product-id-set", modes: ["ONDEMAND", "MONTHLY", "YEARLY"] } },
      ],
      dedupeBy: ["dbEdition", "specification"],
      minByPath: "prices.ONDEMAND",
      postRejectWhenAll: [],
      sort: [
        { path: "dbEdition", direction: "asc", order: ["Basic Edition", "Advanced Edition"] },
        { path: "vCpus", direction: "asc" },
        { path: "memoryGb", direction: "asc" },
      ],
    },
  },
  runtime: {
    quantityLabel: "Instance",
    showGlobalQuantityControl: false,
    usesSharedBillingHeader: true,
    catalog: { route: "gaussdb-pricing" },
    showSharedUsageHours: false,
    derived: [
      {
        key: "editionOptions",
        value: ifElse(ref("catalog"), call("listGaussDbEditions", ref("catalog")), []),
      },
      { key: "dbEdition", value: call("resolveOption", ref("values.dbEdition"), ref("derived.editionOptions"), ref("helpers.gaussDbDefaults.dbEdition")) },
      {
        key: "specificationOptions",
        value: ifElse(
          ref("catalog"),
          call("listGaussDbSpecifications", ref("catalog"), ref("derived.dbEdition")),
          ["4 vCPUs, 16 GB"],
        ),
      },
      { key: "specification", value: call("resolveOption", ref("values.specification"), ref("derived.specificationOptions"), ref("helpers.gaussDbDefaults.specification")) },
      { key: "quantity", value: ifElse(eq(ref("values.billingMode"), "Yearly/Monthly"), max(1, call("clampInteger", ref("values.quantity"), 1)), max(1, call("clampInteger", ref("values.quantity"), 1))) },
      {
        key: "usageHoursValue",
        value: ifElse(eq(ref("values.billingMode"), "Pay-per-use"), max(1, call("clampInteger", ref("values.usageHours"), 1, 87600)), null),
      },
      {
        key: "estimate",
        value: ifElse(
          ref("catalog"),
          call("estimateGaussDbConfiguration", ref("catalog"), {
            dbEdition: ref("derived.dbEdition"),
            specification: ref("derived.specification"),
            quantity: ref("derived.quantity"),
            usageHours: ref("derived.usageHoursValue"),
            billingMode: ref("values.billingMode"),
          }),
          null,
        ),
      },
    ],
    syncValues: {
      dbEdition: ref("derived.dbEdition"),
      specification: ref("derived.specification"),
      quantity: ref("derived.quantity"),
      usageHours: coalesce(ref("derived.usageHoursValue"), ref("helpers.gaussDbDefaults.usageHours")),
      billingMode: ifElse(eq(ref("values.billingMode"), "Yearly/Monthly"), "Yearly/Monthly", "Pay-per-use"),
    },
    visibilityContext: {},
    fieldRuntime: {
      dbEdition: { options: call("optionList", ref("derived.editionOptions")) },
      specification: { options: call("optionList", ref("derived.specificationOptions")) },
      quantity: { min: 1, normalize: ref("derived.quantity") },
      usageHours: { min: 1, max: 87600, normalize: ref("derived.usageHoursValue") },
    },
    estimate: ref("derived.estimate"),
    addToListError: ifElse(ref("derived.estimate"), null, call("firstMeaningfulText", ref("pricingError"), "GaussDB pricing is unavailable for the current selection.")),
    selectionSummary: ifElse(
      ref("derived.estimate"),
      call(
        "joinSelectionParts",
        [
          "Selected specifications:",
          ref("derived.dbEdition"),
          ref("derived.specification"),
          template("{quantity} instance{suffix}", {
            quantity: ref("derived.quantity"),
            suffix: ifElse(eq(ref("derived.quantity"), 1), "", "s"),
          }),
          ifElse(
            eq(ref("values.billingMode"), "Pay-per-use"),
            template("{hours}h", { hours: ref("derived.usageHoursValue") }),
            "Yearly/Monthly",
          ),
          call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.amount"), ref("derived.estimate.suffix")),
        ],
      ),
      "Selected specifications:",
    ),
    selectionNotes: ifElse(
      ref("derived.estimate"),
      call(
        "concatArrays",
        call("formatBreakdownNotes", ref("derived.estimate.currency"), ref("derived.estimate.suffix"), ref("derived.estimate.breakdown")),
        [
          template("Monthly average: {avg}.", {
            avg: call("formatFlavorAmount", ref("derived.estimate.currency"), ref("derived.estimate.monthlyAverageAmount"), "/mo"),
          }),
        ],
        call("asArray", ref("derived.estimate.notes")),
      ),
      [],
    ),
    referenceNote: template(
      "Pricing sourced from Huawei Cloud GaussDB calculator API for {region}. Sources: {pricingUrl} and {productUrl}",
      {
        region: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
        pricingUrl: ref("helpers.gaussDbPricingReference.pricingUrl"),
        productUrl: ref("helpers.gaussDbPricingReference.productUrl"),
      },
    ),
    buildRequestBodies: ifElse(
      ref("derived.estimate"),
      {
        serviceCode: ref("selectedServiceCode"),
        serviceName: ref("selectedService"),
        productType: "gaussdb",
        title: template("{service} {dbEdition} {specification}", {
          service: ref("selectedService"),
          dbEdition: ref("derived.dbEdition"),
          specification: ref("derived.specification"),
        }),
        quantity: 1,
        config: {
          region: ref("regionValue"),
          catalogRegionId: coalesce(ref("catalogRegionId"), call("getCatalogRegionId", ref("regionValue"))),
          billingMode: ref("values.billingMode"),
          dbEdition: ref("derived.dbEdition"),
          specification: ref("derived.specification"),
          quantity: ref("derived.quantity"),
          usageHours: ref("derived.usageHoursValue"),
          resourceSpecCode: ref("derived.estimate.tier.resourceSpecCode"),
          productId: coalesce(
            ifElse(eq(ref("values.billingMode"), "Pay-per-use"), ref("derived.estimate.tier.productIds.ONDEMAND"), null),
            ref("derived.estimate.tier.productIds.MONTHLY"),
          ),
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
      and(eq(ref("product.productType"), "gaussdb"), call("isRecord", ref("product.config"))),
      {
        handled: true,
        values: {
          dbEdition: coalesce(ref("product.config.dbEdition"), ref("helpers.gaussDbDefaults.dbEdition")),
          specification: coalesce(ref("product.config.specification"), ref("helpers.gaussDbDefaults.specification")),
          quantity: coalesce(ref("product.config.quantity"), ref("helpers.gaussDbDefaults.quantity")),
          usageHours: coalesce(ref("product.config.usageHours"), ref("helpers.gaussDbDefaults.usageHours")),
          billingMode: ifElse(eq(ref("product.config.billingMode"), "Yearly/Monthly"), "Yearly/Monthly", "Pay-per-use"),
        },
        nextRegion: coalesce(ref("product.config.region"), ref("regionValue")),
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
